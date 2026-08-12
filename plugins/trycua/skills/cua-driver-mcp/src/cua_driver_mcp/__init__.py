"""Prime Agent bridge for an installed Cua Driver from trycua/cua.

This package intentionally does not bundle Cua Driver source code or binaries.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from rlm import McpIntegration

MIN_CUA_DRIVER_VERSION = "0.19.0"

# The typed browser surface introduced by the Rust driver is intentionally
# listed here so a Prime Agent kernel can discover the page-aware API before it
# has opened a live MCP session. The server remains the source of truth for
# schemas and availability; these names are only the stable workflow surface.
BROWSER_TOOLS = (
    "get_browser_state",
    "browser_prepare",
    "browser_navigate",
    "browser_click",
    "browser_type",
    "browser_pointer",
    "browser_dialog",
    "browser_set_input_files",
    "browser_download",
)

_EXPLICIT_WORKFLOW_TOOLS = (
    "start_session",
    "list_apps",
    "list_windows",
    "launch_app",
    *BROWSER_TOOLS,
    "end_session",
)

__all__ = [
    "BROWSER_TOOLS",
    "CuaDriverMcp",
    "MIN_CUA_DRIVER_VERSION",
    "cua_driver_mcp",
    "installed_driver_version",
    *_EXPLICIT_WORKFLOW_TOOLS,
]

_DEFAULT_COMMAND = str(Path.home() / ".local" / "bin" / "cua-driver")
_VERSION_RE = re.compile(r"\b(?:cua-driver(?:-rs)?\s+)?v?(\d+)\.(\d+)\.(\d+)\b", re.IGNORECASE)
_MIN_VERSION = tuple(int(part) for part in MIN_CUA_DRIVER_VERSION.split("."))


def _agent_dir() -> Path:
    raw = (
        os.environ.get("PRIME_AGENT_CODING_AGENT_DIR")
        or os.environ.get("PI_CODING_AGENT_DIR")
        or str(Path.home() / ".prime" / "agent")
    )
    return Path(raw).expanduser().resolve()


def _read_stdio_config() -> tuple[str, list[str], dict[str, str] | None]:
    """Read the user's configured mcpServers.cua-driver entry."""
    command = _DEFAULT_COMMAND
    args = ["mcp"]
    env: dict[str, str] | None = None
    settings_path = _agent_dir() / "settings.json"
    try:
        settings: Any = json.loads(settings_path.read_text())
        raw = settings.get("mcpServers", {}).get("cua-driver", {})
    except (OSError, ValueError, AttributeError):
        raw = {}
    if isinstance(raw, dict) and raw.get("type") == "stdio":
        configured_command = raw.get("command")
        configured_args = raw.get("args")
        configured_env = raw.get("env")
        if isinstance(configured_command, str) and configured_command.strip():
            command = configured_command
        if isinstance(configured_args, list) and all(isinstance(item, str) for item in configured_args):
            args = list(configured_args)
        if isinstance(configured_env, dict) and all(
            isinstance(key, str) and isinstance(value, str)
            for key, value in configured_env.items()
        ):
            env = dict(configured_env)
    return command, args, env


def _looks_like_cua_driver(command: str) -> bool:
    name = Path(command).name.lower()
    return name in {"cua-driver", "cua-driver.exe"}


def _environment_for_probe(env: dict[str, str] | None) -> dict[str, str]:
    merged = os.environ.copy()
    if env:
        merged.update(env)
    return merged


def _probe_driver_version(
    command: str, env: dict[str, str]
) -> tuple[int, int, int] | None:
    try:
        result = subprocess.run(
            [command, "--version"],
            capture_output=True,
            check=False,
            env=env,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None

    if result.returncode != 0:
        return None
    output = f"{result.stdout}\n{result.stderr}"
    match = _VERSION_RE.search(output)
    if match is None:
        return None
    return tuple(int(part) for part in match.groups())


def _version_text(version: tuple[int, int, int] | None) -> str:
    return ".".join(str(part) for part in version) if version else "unknown"


def installed_driver_version() -> str | None:
    """Return the configured Cua Driver version when it can be probed."""

    command, _args, env = _read_stdio_config()
    if not _looks_like_cua_driver(command):
        return None
    version = _probe_driver_version(command, _environment_for_probe(env))
    return _version_text(version) if version else None


def _ensure_supported_driver(command: str, env: dict[str, str] | None) -> None:
    """Fail early with an actionable error when an old driver is configured."""

    # A custom wrapper may not accept --version. Leave its version contract to
    # that wrapper, while enforcing the upstream binary used by this plugin.
    if not _looks_like_cua_driver(command):
        return

    version = _probe_driver_version(command, _environment_for_probe(env))
    if version is None:
        raise RuntimeError(
            f"Could not determine the Cua Driver version for {command!r}. "
            f"Install Cua Driver {MIN_CUA_DRIVER_VERSION} or newer and ensure it is executable."
        )
    if version < _MIN_VERSION:
        raise RuntimeError(
            f"Cua Driver {MIN_CUA_DRIVER_VERSION}+ is required for the Prime Agent browser tools; "
            f"found {_version_text(version)}. Run `cua-driver update --apply` and reload Prime Agent."
        )


class CuaDriverMcp(McpIntegration):
    """Expose tools from an existing upstream Cua Driver MCP server."""

    server = "cua-driver"

    async def _open_session(self, stack: AsyncExitStack):
        command, args, env = _read_stdio_config()
        _ensure_supported_driver(command, env)
        params = StdioServerParameters(command=command, args=args, env=env)
        read, write, *_ = await stack.enter_async_context(stdio_client(params))
        session = await stack.enter_async_context(ClientSession(read, write))
        await session.initialize()
        return session

    async def _call_explicit_tool(self, name: str, arguments: dict[str, Any]) -> Any:
        """Call a documented workflow tool while retaining live schema checks."""

        await self._ensure_tools()
        if self._tools is not None and name not in self._tools:
            available = ", ".join(sorted(self._tools)) or "(none)"
            raise AttributeError(f"'{self.server}' has no tool '{name}'. Available: {available}")
        return await self.call_tool(name, arguments)


cua_driver_mcp = CuaDriverMcp()

_RESERVED = {"run", "__wrapped__", "__call__"}


def _make_workflow_forwarder(name: str):
    async def _forward(self: CuaDriverMcp, **kwargs: Any) -> Any:
        return await self._call_explicit_tool(name, kwargs)

    _forward.__name__ = name
    _forward.__qualname__ = f"CuaDriverMcp.{name}"
    _forward.__doc__ = (
        f"Call the upstream `{name}` MCP tool. "
        "Use `list_tools()` for the live JSON schema."
    )
    return _forward


# Give Prime Agent's persistent kernel concrete browser/session attributes to
# discover while preserving the base integration's dynamic forwarding for every
# other tool (including tools added by later Cua Driver releases).
for _tool_name in _EXPLICIT_WORKFLOW_TOOLS:
    setattr(CuaDriverMcp, _tool_name, _make_workflow_forwarder(_tool_name))


def __getattr__(name: str):
    if name.startswith("_") or name in _RESERVED:
        raise AttributeError(name)
    return getattr(cua_driver_mcp, name)


def __dir__():
    return sorted(set(globals()) | set(_EXPLICIT_WORKFLOW_TOOLS))
