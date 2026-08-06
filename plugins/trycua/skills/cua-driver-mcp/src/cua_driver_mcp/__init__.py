"""Prime Agent bridge for an installed Cua Driver from trycua/cua.

This package intentionally does not bundle Cua Driver source code or binaries.
"""

from __future__ import annotations

import json
import os
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from rlm import McpIntegration

__all__ = ["CuaDriverMcp", "cua_driver_mcp"]

_DEFAULT_COMMAND = str(Path.home() / ".local" / "bin" / "cua-driver")


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


class CuaDriverMcp(McpIntegration):
    """Expose tools from an existing upstream Cua Driver MCP server."""

    server = "cua-driver"

    async def _open_session(self, stack: AsyncExitStack):
        command, args, env = _read_stdio_config()
        params = StdioServerParameters(command=command, args=args, env=env)
        read, write, *_ = await stack.enter_async_context(stdio_client(params))
        session = await stack.enter_async_context(ClientSession(read, write))
        await session.initialize()
        return session


cua_driver_mcp = CuaDriverMcp()

_RESERVED = {"run", "__wrapped__", "__call__"}


def __getattr__(name: str):
    if name.startswith("_") or name in _RESERVED:
        raise AttributeError(name)
    return getattr(cua_driver_mcp, name)
