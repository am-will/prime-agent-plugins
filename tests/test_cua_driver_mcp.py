from __future__ import annotations

import importlib.util
import subprocess
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


class FakeMcpIntegration:
    def __init__(self) -> None:
        self._tools = None
        self.calls = []

    async def _ensure_tools(self) -> None:
        if self._tools is None:
            self._tools = {"browser_click": {}}

    async def call_tool(self, name, arguments):
        self.calls.append((name, arguments))
        return {"name": name, "arguments": arguments}


def load_module():
    mcp = types.ModuleType("mcp")
    mcp.ClientSession = object
    mcp.StdioServerParameters = object
    mcp_client = types.ModuleType("mcp.client")
    mcp_stdio = types.ModuleType("mcp.client.stdio")
    mcp_stdio.stdio_client = object
    rlm = types.ModuleType("rlm")
    rlm.McpIntegration = FakeMcpIntegration
    modules = {
        "mcp": mcp,
        "mcp.client": mcp_client,
        "mcp.client.stdio": mcp_stdio,
        "rlm": rlm,
    }
    path = Path(__file__).parents[1] / "plugins/trycua/skills/cua-driver-mcp/src/cua_driver_mcp/__init__.py"
    spec = importlib.util.spec_from_file_location("cua_driver_mcp_under_test", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, modules):
        spec.loader.exec_module(module)
    return module


class CuaDriverVersionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_module()

    def test_accepts_supported_upstream_version(self) -> None:
        result = subprocess.CompletedProcess([], 0, "cua-driver 0.19.0\n", "")
        with patch.object(self.module.subprocess, "run", return_value=result):
            self.module._ensure_supported_driver("/usr/local/bin/cua-driver", None)

    def test_rejects_old_and_failed_version_probes(self) -> None:
        old = subprocess.CompletedProcess([], 0, "cua-driver 0.18.9\n", "")
        with patch.object(self.module.subprocess, "run", return_value=old):
            with self.assertRaisesRegex(RuntimeError, "0.19.0\\+"):
                self.module._ensure_supported_driver("cua-driver", None)

        failed = subprocess.CompletedProcess([], 1, "", "error mentions 99.99.99")
        with patch.object(self.module.subprocess, "run", return_value=failed):
            with self.assertRaisesRegex(RuntimeError, "Could not determine"):
                self.module._ensure_supported_driver("cua-driver", None)

    def test_custom_wrapper_owns_its_version_contract(self) -> None:
        with patch.object(self.module.subprocess, "run") as run:
            self.module._ensure_supported_driver("/opt/bin/cua-wrapper", {"PROFILE": "test"})
        run.assert_not_called()


class CuaDriverForwarderTests(unittest.IsolatedAsyncioTestCase):
    async def test_typed_browser_method_calls_live_tool(self) -> None:
        module = load_module()
        bridge = module.CuaDriverMcp()
        result = await bridge.browser_click(ref="button-1", session="test")
        self.assertEqual(result["name"], "browser_click")
        self.assertEqual(bridge.calls, [("browser_click", {"ref": "button-1", "session": "test"})])

    async def test_missing_typed_tool_reports_live_catalog(self) -> None:
        module = load_module()
        bridge = module.CuaDriverMcp()
        bridge._tools = {"read_screen": {}}
        with self.assertRaisesRegex(AttributeError, "Available: read_screen"):
            await bridge.browser_click(ref="button-1")


if __name__ == "__main__":
    unittest.main()
