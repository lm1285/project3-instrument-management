import sys
import types
from pathlib import Path


xbot = types.ModuleType("xbot")
xbot.print = print
xbot.sleep = lambda *_args, **_kwargs: None
xbot.app = types.SimpleNamespace(excel=types.SimpleNamespace(get_active_workbook=lambda: None))
sys.modules["xbot"] = xbot
sys.modules["xbot.app"] = xbot.app

sys.path.insert(0, str(Path(__file__).resolve().parent))

import bingxijing  # noqa: E402


def test_import_and_entrypoint():
    assert hasattr(bingxijing, "main")
    assert callable(bingxijing.main)


if __name__ == "__main__":
    test_import_and_entrypoint()
    print("ok")
