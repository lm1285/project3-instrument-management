import copy
import random
import re
import statistics
import os

try:
    import xbot
    import xbot.app
    from xbot import print, sleep
except Exception:  # pragma: no cover
    xbot = None
    from builtins import print
    from time import sleep


最近结果历史 = {
    "重复性百分比": {},
    "示值误差组": {},
}


默认配置 = {
    "说明": "可在下方持续追加不同气体类型的配置，同一个模块可服务多种气体、同一个 Excel 可按不同气体类型分别调用。",
    "测量范围规则": [
        {"单位": "%LEL", "正则": r".*?\(?\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*\)?\s*%LEL"},
        {"单位": "%VOL", "正则": r".*?\(?\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*\)?\s*%VOL"},
        {"单位": "umol/mol", "正则": r".*?\(?\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*\)?\s*(?:ppm|umol/mol)"},
        {"单位": "%", "正则": r".*?\(?\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*\)?\s*%"},
        {"单位": "", "正则": r".*?\(?\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*\)?"},
    ],
    "生成规则": {
        "示值误差": {
            "mpe安全系数": 0.94,
            "最小有效误差": 0.3,
            "禁用误差区间": [-0.5, 0.5],
            "禁用误差区间豁免气体": ["氧气", "O2"],
            "优先误差比例范围": [0.2, 0.8],
            "比例浮动范围": [0.0, 0.22],
            "最小测量值步差": 1,
            "测量值小数位": 1,
            "误差组离散系数": 0.18,
            "误差组最大跨度系数": 0.24,
            "测量值最大波动系数": 0.45,
            "MPE分段最大离散比例": {
                "大于5": 0.2,
                "2到5": 0.3,
                "小于2": 0.4,
            },
            "最大尝试次数": 200,
            "整组最大尝试次数": 24,
        },
        "重复性": {
            "测量值小数位": 1,
            "默认标准值比例": 0.4,
            "基准值个数范围": [3, 4],
            "波动步进倍数范围": [0, 1],
            "mpe安全系数": 0.9,
            "目标MPE利用率范围": [0.2, 0.9],
            "最小变化步数": 1,
            "最大尝试次数": 320,
            "整组最大尝试次数": 36,
            "避免重复百分比步进": 0.05,
        },
        "响应时间": {
            "测量值小数位": 1,
            "默认范围": [12.0, 20.0],
            "默认组内最大差值": 4.0,
            "最大尝试次数": 80,
            "规则": [
                {"匹配": "30s<=x<=60s", "生成范围": [15.0, 25.0], "组内最大差值": 5.0},
                {"匹配": "<=30s", "生成范围": [8.0, 12.0], "组内最大差值": 3.0},
                {"匹配": ">=180s", "生成范围": [50.0, 70.0], "组内最大差值": 15.0},
            ],
        },
    },
    "气体配置列表": [
        {
            "气体类型": "可燃",
            "关键字": ["可燃", "LEL", "甲烷", "CH4"],
            "量程写入": {
                "最小值": {"行": 8, "列": "V"},
                "最大值": {"行": 8, "列": "AA"},
            },
            "示值误差": {
                "误差方式": "引用",
                "小数位数": 0,
                "行": [11, 12, 13],
                "标准值列": "E",
                "测量值列": ["I", "L", "O"],
                "公式列": "U",
                "MPE列": "X",
            },
            "重复性": {
                "小数位数": 0,
                "行号": 16,
                "标准值列": "B",
                "测量值列": ["F", "I", "L", "O", "R", "U"],
                "公式列": "X",
                "MPE列": "AA",
            },
            "响应时间": {
                "小数位数": 2,
                "行号": 19,
                "测量值列": ["F", "J", "N"],
                "公式列": "R",
                "MPE列": "X",
            },
        },
        {
            "气体类型": "氧气",
            "关键字": ["氧气", "%", "O2"],
            "量程写入": {
                "最小值": {"行": 3, "列": "Y"},
                "最大值": {"行": 3, "列": "AB"},
            },
            "示值误差": {
                "误差方式": "引用",
                "小数位数": 1,
                "行": [6, 7, 8],
                "标准值列": "B",
                "测量值列": ["F", "I", "L"],
                "公式列": "R",
                "MPE列": "V",
            },
            "重复性": {
                "小数位数": 1,
                "行号": 11,
                "标准值列": "B",
                "测量值列": ["F", "I", "L", "O", "R", "U"],
                "公式列": "X",
                "MPE列": "AA",
            },
            "响应时间": {
                "小数位数": 2,
                "行号": 14,
                "测量值列": ["F", "J", "N"],
                "公式列": "R",
                "MPE列": "W",
            },
        },
        {
            "气体类型": "硫化氢",
            "关键字": ["硫化氢", "H2S"],
            "量程写入": {
                "最小值": {"行": 6, "列": "X"},
                "最大值": {"行": 6, "列": "Z"},
            },
            "示值误差": {
                "误差方式": "相对",
                "小数位数": 1,
                "行": [9, 10, 11],
                "标准值列": "B",
                "测量值列": ["F", "I", "L"],
                "公式列": "R",
                "MPE列": "V",
            },
            "重复性": {
                "小数位数": 1,
                "行号": 14,
                "标准值列": "B",
                "测量值列": ["F", "I", "L", "O", "R", "U"],
                "公式列": "X",
                "MPE列": "AA",
            },
            "响应时间": {
                "小数位数": 2,
                "行号": 17,
                "测量值列": ["F", "J", "N"],
                "公式列": "R",
                "MPE列": "X",
            },
        },
        {
            "气体类型": "一氧化碳",
            "关键字": ["一氧化碳", "CO"],
            "量程写入": {
                "最小值": {"行": 8, "列": "X"},
                "最大值": {"行": 8, "列": "AA"},
            },
            "示值误差": {
                "误差方式": "相对",
                "小量程行级扰动": {
                    "启用量程上限": 100,
                    "行误差比例范围": {
                        11: [0.46, 0.78],
                        12: [0.22, 0.56],
                        13: [0.52, 0.86],
                    },
                    "行比例浮动范围": {
                        11: [0.06, 0.24],
                        12: [0.08, 0.28],
                        13: [0.06, 0.22],
                    },
                },
                "小数位数": 0,
                "行": [11, 12, 13],
                "标准值列": "B",
                "测量值列": ["I", "L", "O"],
                "公式列": "U",
                "MPE列": "X",
            },
            "重复性": {
                "小数位数": 0,
                "行号": 16,
                "标准值列": "B",
                "测量值列": ["F", "I", "L", "O", "R", "U"],
                "公式列": "X",
                "MPE列": "AA",
            },
            "响应时间": {
                "小数位数": 2,
                "行号": 19,
                "测量值列": ["F", "J", "N"],
                "公式列": "R",
                "MPE列": "X",
            },
        },
        {
            "气体类型": "氨气",
            "关键字": ["氨气", "NH3"],
            "量程写入": {
                "最小值": {"行": 7, "列": "X"},
                "最大值": {"行": 7, "列": "Z"},
            },
            "示值误差": {
                "误差方式": "相对",
                "小数位数": 0,
                "行": [10, 11, 12],
                "标准值列": "B",
                "测量值列": ["F", "I", "L"],
                "公式列": "R",
                "MPE列": "V",
            },
            "重复性": {
                "小数位数": 0,
                "行号": 15,
                "标准值列": "B",
                "测量值列": ["F", "I", "L", "O", "R", "U"],
                "公式列": "X",
                "MPE列": "AA",
            },
            "响应时间": {
                "小数位数": 2,
                "行号": 18,
                "测量值列": ["F", "J", "N"],
                "公式列": "R",
                "MPE列": "X",
            },
        },
        {
            "气体类型": "VOC",
            "关键字": ["VOC", "异丁烯", "挥发"],
            "量程写入": {
                "最小值": {"行": 2, "列": "V"},
                "最大值": {"行": 2, "列": "Y"},
            },
            "示值误差": {
                "误差方式": "绝对",
                "小数位数": 0,
                "行": [5, 6, 7],
                "标准值列": "A",
                "测量值列": ["E", "H", "K"],
                "公式列": "Q",
                "MPE列": "U",
            },
            "重复性": {
                "小数位数": 0,
                "行号": 10,
                "标准值列": "A",
                "测量值列": ["E", "H", "K", "N", "Q", "T"],
                "公式列": "W",
                "MPE列": "Z",
            },
            "响应时间": {
                "小数位数": 2,
                "行号": 13,
                "测量值列": ["E", "I", "M"],
                "公式列": "Q",
                "MPE列": "W",
            },
        },
        {
            "气体类型": "二氧化氮",
            "关键字": ["二氧化氮", "NO2"],
            "量程写入": {
                "最小值": {"行": 5, "列": "X"},
                "最大值": {"行": 5, "列": "Z"},
            },
            "示值误差": {
                "误差方式": "相对",
                "小数位数": 1,
                "最小有效误差": 0.1,
                "优先误差比例范围": [0.3, 0.8],
                "比例浮动范围": [0.03, 0.12],
                "误差组最大跨度系数": 0.55,
                "测量值最大波动系数": 0.72,
                "最小不同测量值数": 3,
                "全组目标误差比例范围": [0.3, 0.8],
                "全组组误差最大差值比例": 0.2,
                "小量程行级扰动": {
                    "启用量程上限": 20,
                    "适用气体": ["二氧化氮", "NO2"],
                    "行误差比例范围": {
                        8: [0.30, 0.70],
                        9: [0.40, 0.80],
                        10: [0.35, 0.78],
                    },
                    "行比例浮动范围": {
                        8: [0.03, 0.12],
                        9: [0.03, 0.10],
                        10: [0.03, 0.12],
                    },
                },
                "行": [8, 9, 10],
                "标准值列": "B",
                "测量值列": ["F", "I", "L"],
                "公式列": "R",
                "MPE列": "V",
            },
            "重复性": {
                "小数位数": 1,
                "目标MPE利用率范围": [0.45, 0.9],
                "最小变化步数": 3,
                "最小不同测量值数": 3,
                "避免重复百分比步进": 0.08,
                "参考标准值比例范围": [0.2, 0.85],
                "参考行随机候选数": 3,
                "行号": 13,
                "标准值列": "B",
                "测量值列": ["F", "I", "L", "O", "R", "U"],
                "公式列": "X",
                "MPE列": "AA",
            },
            "响应时间": {
                "小数位数": 2,
                "行号": 16,
                "测量值列": ["F", "J", "N"],
                "公式列": "R",
                "MPE列": "X",
            },
        },
    ],
}


def 安全取属性(obj, attr_name, default=None):
    try:
        return getattr(obj, attr_name, default)
    except Exception:
        return default


def 深合并(base, patch):
    if not isinstance(base, dict) or not isinstance(patch, dict):
        return copy.deepcopy(patch)
    result = copy.deepcopy(base)
    for key, value in patch.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = 深合并(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def 规范化文本(text):
    mapping = {
        "（": "(",
        "）": ")",
        "－": "-",
        "–": "-",
        "—": "-",
        "％": "%",
        "≤": "<=",
        "≥": ">=",
        "＜": "<=",
        "＞": ">=",
        "μ": "u",
        "μmol/mol": "umol/mol",
        "μmol": "umol",
    }
    result = str(text or "").strip()
    for old, new in mapping.items():
        result = result.replace(old, new)
    return result


def 收集工作簿标识(excel_obj):
    标识 = set()
    if not excel_obj:
        return 标识
    candidates = [
        excel_obj,
        安全取属性(excel_obj, "wb"),
        安全取属性(excel_obj, "workbook"),
        安全取属性(excel_obj, "_workbook"),
        安全取属性(excel_obj, "book"),
    ]
    for item in candidates:
        if not item:
            continue
        for attr_name in ("Name", "name", "FullName", "fullname", "Path", "path", "file_path", "filename"):
            value = 安全取属性(item, attr_name)
            if isinstance(value, str) and value.strip():
                标识.add(value.strip().lower())
    return 标识


def 是Win32工作簿对象(obj):
    return bool(obj) and hasattr(obj, "ActiveSheet") and (hasattr(obj, "Worksheets") or hasattr(obj, "Sheets"))


def 遍历已打开工作簿(xl_app):
    try:
        workbooks = xl_app.Workbooks
        for index in range(1, workbooks.Count + 1):
            yield workbooks(index)
    except Exception:
        return


class Win32SheetAdapter:
    def __init__(self, sheet):
        self.sheet = sheet

    def get_range(self, row, col, row2, col2):
        try:
            cell = self.sheet.Range(f"{col}{row}") if isinstance(col, str) else self.sheet.Cells(row, col)
            return [[cell.Value]]
        except Exception:
            return None

    def get_formula(self, row, col):
        try:
            cell = self.sheet.Range(f"{col}{row}") if isinstance(col, str) else self.sheet.Cells(row, col)
            for attr_name in ("Formula", "FormulaLocal"):
                formula = 安全取属性(cell, attr_name)
                if isinstance(formula, str) and formula:
                    return formula
        except Exception as e:
            print(f"Win32 读取公式失败 {col}{row}: {e}")
        return None

    def set_range(self, row, col, data):
        try:
            value = data
            if isinstance(data, (list, tuple)):
                if data and isinstance(data[0], (list, tuple)):
                    value = data[0][0]
                elif data:
                    value = data[0]
            cell = self.sheet.Range(f"{col}{row}") if isinstance(col, str) else self.sheet.Cells(row, col)
            cell.Value = value
        except Exception as e:
            print(f"Win32 写入失败 {col}{row}: {e}")

    def set_number_format(self, row, col, number_format):
        try:
            cell = self.sheet.Range(f"{col}{row}") if isinstance(col, str) else self.sheet.Cells(row, col)
            cell.NumberFormat = number_format
        except Exception as e:
            print(f"Win32 设置格式失败 {col}{row}: {e}")


class Win32WorkbookAdapter:
    def __init__(self, workbook):
        self.wb = workbook

    def get_active_sheet(self):
        return Win32SheetAdapter(self.wb.ActiveSheet)

    def activate_sheet(self, sheet_name):
        try:
            self.wb.Worksheets(sheet_name).Activate()
            return True
        except Exception:
            try:
                self.wb.Sheets(sheet_name).Activate()
                return True
            except Exception:
                return False


def 尝试从Excel对象获取COM工作簿(excel_obj, allow_active_fallback=False):
    if not excel_obj:
        return None
    if isinstance(excel_obj, Win32WorkbookAdapter):
        return excel_obj.wb

    direct_candidates = [
        excel_obj,
        安全取属性(excel_obj, "wb"),
        安全取属性(excel_obj, "workbook"),
        安全取属性(excel_obj, "_workbook"),
        安全取属性(excel_obj, "book"),
    ]
    for item in direct_candidates:
        if 是Win32工作簿对象(item):
            return item

    try:
        import win32com.client

        xl_app = win32com.client.GetActiveObject("Excel.Application")
    except Exception:
        return None

    标识 = 收集工作簿标识(excel_obj)
    if 标识:
        for workbook in 遍历已打开工作簿(xl_app):
            names = {
                str(value).strip().lower()
                for value in (
                    安全取属性(workbook, "Name"),
                    安全取属性(workbook, "FullName"),
                    安全取属性(workbook, "Path"),
                )
                if value
            }
            if 标识 & names:
                return workbook

    if allow_active_fallback:
        return 安全取属性(xl_app, "ActiveWorkbook")
    return None


def 规范化Excel对象(excel_obj, allow_active_fallback=False):
    if not excel_obj:
        return None
    if isinstance(excel_obj, Win32WorkbookAdapter):
        return excel_obj
    workbook = 尝试从Excel对象获取COM工作簿(excel_obj, allow_active_fallback=allow_active_fallback)
    if workbook:
        print(f"已切换到 Win32 COM 工作簿: {安全取属性(workbook, 'Name', 'UnknownWorkbook')}")
        return Win32WorkbookAdapter(workbook)
    return excel_obj


def 读取单元格值(sheet, row, col):
    try:
        if hasattr(sheet, "get_range"):
            result = sheet.get_range(row, col, row, col)
            if result and result[0]:
                return result[0][0]
        if hasattr(sheet, "Range"):
            cell = sheet.Range(f"{col}{row}") if isinstance(col, str) else sheet.Cells(row, col)
            return cell.Value
    except Exception as e:
        print(f"读取单元格值失败 {col}{row}: {e}")
    return None


def 读取单元格公式(sheet, row, col):
    try:
        if hasattr(sheet, "get_formula"):
            formula = sheet.get_formula(row, col)
            if formula:
                return str(formula)
        if hasattr(sheet, "Range"):
            cell = sheet.Range(f"{col}{row}") if isinstance(col, str) else sheet.Cells(row, col)
            for attr_name in ("Formula", "FormulaLocal"):
                formula = 安全取属性(cell, attr_name)
                if isinstance(formula, str) and formula:
                    return formula
        value = 读取单元格值(sheet, row, col)
        if isinstance(value, str) and value.startswith("="):
            return value
    except Exception as e:
        print(f"读取单元格公式失败 {col}{row}: {e}")
    return None


def 生成数字格式(decimals):
    decimals = max(0, int(decimals or 0))
    if decimals <= 0:
        return "0"
    return "0." + ("0" * decimals)


def 写入单元格值(sheet, row, col, value, decimals=None):
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    try:
        if hasattr(sheet, "set_range"):
            sheet.set_range(row, col, [[value]])
            if decimals is not None and hasattr(sheet, "set_number_format"):
                sheet.set_number_format(row, col, 生成数字格式(decimals))
            return
        if hasattr(sheet, "Range"):
            cell = sheet.Range(f"{col}{row}") if isinstance(col, str) else sheet.Cells(row, col)
            cell.Value = value
            if decimals is not None:
                cell.NumberFormat = 生成数字格式(decimals)
    except Exception as e:
        print(f"写入单元格值失败 {col}{row}: {e}")


def 解析测量范围(measurement_range_str, config):
    text = 规范化文本(measurement_range_str)
    气体描述 = text.split(",")[0].strip() if "," in text else text.split("，")[0].strip()
    for rule in config["测量范围规则"]:
        match = re.search(rule["正则"], text, re.IGNORECASE)
        if match:
            return {
                "气体描述": 气体描述,
                "最小值": float(match.group(1)),
                "最大值": float(match.group(2)),
                "单位": rule["单位"],
                "原始文本": measurement_range_str,
            }
    return None


def 判断误差方式(formula_str):
    if not formula_str:
        return "绝对"
    text = 规范化文本(formula_str).lower().replace("$", "")
    if "v8" in text or "aa8" in text or "量程" in text or "fs" in text or "量程误差" in text:
        return "引用"
    if re.search(r"/\s*[a-z]{1,3}\d+", text) or re.search(r"/\s*r\d+c\d+", text) or "/e" in text:
        return "相对"
    return "绝对"


def 获取默认误差方式(气体类型):
    gas_type = str(气体类型 or "").strip().lower()
    mapping = {
        "可燃": "引用",
        "氧气": "引用",
        "o2": "引用",
        "电化学氧": "引用",
        "硫化氢": "相对",
        "h2s": "相对",
        "一氧化碳": "相对",
        "co": "相对",
        "氨气": "相对",
        "nh3": "相对",
        "二氧化氮": "相对",
        "no2": "相对",
        "voc": "绝对",
    }
    return mapping.get(gas_type)


def 解析MPE数值(mpe_value):
    if mpe_value is None or mpe_value == "":
        return None
    if isinstance(mpe_value, (int, float)):
        return float(mpe_value)
    text = 规范化文本(mpe_value).replace("±", "").strip()
    match = re.search(r"(\d+(?:\.\d+)?)", text)
    if not match:
        return None
    return float(match.group(1))


def 计算误差值(误差方式, standard_value, measured_value, range_min, range_max):
    absolute_error = measured_value - standard_value
    if 误差方式 == "绝对":
        return absolute_error
    if 误差方式 == "相对":
        if standard_value == 0:
            return 0.0
        return absolute_error / standard_value * 100.0
    if range_max == range_min:
        return 0.0
    return absolute_error / (range_max - range_min) * 100.0


def 误差值转绝对偏差(误差方式, standard_value, metric_error, range_min, range_max):
    if 误差方式 == "绝对":
        return metric_error
    if 误差方式 == "相对":
        return standard_value * metric_error / 100.0
    return (range_max - range_min) * metric_error / 100.0


def 限制范围(value, lower, upper):
    return max(lower, min(upper, value))


def 计算误差组最大离散比例(limit_metric, rule):
    segment_rule = rule.get("MPE分段最大离散比例", {})
    if limit_metric > 5:
        return float(segment_rule.get("大于5", 0.2))
    if limit_metric >= 2:
        return float(segment_rule.get("2到5", 0.3))
    return float(segment_rule.get("小于2", 0.4))


def 生成历史键(gas_config, range_info, row, mpe_value, tag):
    gas_type = str(gas_config.get("气体类型", "未命名"))
    range_min = float(range_info.get("最小值", 0) or 0)
    range_max = float(range_info.get("最大值", 0) or 0)
    mpe_text = "" if mpe_value is None else f"{float(mpe_value):.6f}"
    return f"{tag}|{gas_type}|{range_min:.6f}|{range_max:.6f}|{row}|{mpe_text}"


def 读取最近历史(bucket_name, history_key, limit=10):
    bucket = 最近结果历史.setdefault(bucket_name, {})
    values = bucket.get(history_key, [])
    return list(values[-max(1, int(limit)):])


def 记录最近历史(bucket_name, history_key, value, limit=12):
    bucket = 最近结果历史.setdefault(bucket_name, {})
    values = bucket.setdefault(history_key, [])
    values.append(value)
    if len(values) > limit:
        del values[:-limit]


def 历史重复次数(bucket_name, history_key, value, tolerance=0.0):
    history = 读取最近历史(bucket_name, history_key, limit=12)
    count = 0
    for item in history:
        if tolerance > 0:
            if abs(float(item) - float(value)) <= tolerance:
                count += 1
        elif item == value:
            count += 1
    return count


def 是否二氧化氮零到二十场景(gas_config, range_info):
    if gas_config.get("强制定向场景") == "二氧化氮0-20":
        return True
    gas_type = 规范化文本(str(gas_config.get("气体类型", ""))).strip().lower()
    if not gas_type or ("二氧化氮" not in gas_type and "no2" not in gas_type):
        return False
    try:
        return float(range_info.get("最小值", 0) or 0) == 0 and float(range_info.get("最大值", 0) or 0) == 20
    except Exception:
        return False


def 生成定向相对误差测量值(标准值, target_percent, sign, decimals, min_distinct=3):
    step = 1 / (10 ** decimals) if decimals > 0 else 1.0
    signed_step = step if sign > 0 else -step

    if abs(标准值 - 4.0) < 1e-9 and decimals == 1:
        base = 标准值 + signed_step
        values = [round(base, decimals), round(base + signed_step, decimals), round(base + signed_step * 2, decimals)]
    elif abs(标准值 - 10.0) < 1e-9 and decimals == 1:
        target_steps = max(3, min(8, int(round(target_percent / 1.0))))
        start_steps = max(1, target_steps - 1)
        values = [
            round(标准值 + signed_step * start_steps, decimals),
            round(标准值 + signed_step * (start_steps + 1), decimals),
            round(标准值 + signed_step * (start_steps + 2), decimals),
        ]
    elif abs(标准值 - 16.0) < 1e-9 and decimals == 1:
        target_steps = max(6, min(12, int(round(target_percent / 0.625))))
        start_steps = max(1, target_steps - 1)
        values = [
            round(标准值 + signed_step * start_steps, decimals),
            round(标准值 + signed_step * (start_steps + 1), decimals),
            round(标准值 + signed_step * (start_steps + 2), decimals),
        ]
    else:
        absolute_offset = 标准值 * target_percent / 100.0
        base_steps = max(1, int(round(abs(absolute_offset) / step)))
        values = [
            round(标准值 + sign * base_steps * step, decimals),
            round(标准值 + sign * (base_steps + 1) * step, decimals),
            round(标准值 + sign * (base_steps + 2) * step, decimals),
        ]

    if len(set(values)) < min_distinct:
        values = sorted(set(values))
        while len(values) < min_distinct:
            values.append(round(values[-1] + signed_step, decimals))
    return values[:3]


def 生成二氧化氮零到二十示值误差(sheet, gas_config, rule_config, range_info):
    section = gas_config["示值误差"]
    rows, measure_cols = 读取行列列表位置(section)
    standards = [float(读取单元格值(sheet, row, section["标准值列"])) for row in rows]
    mpes = [解析MPE数值(读取单元格值(sheet, row, section["MPE列"])) for row in rows]
    decimals = int(section.get("小数位数", rule_config["示值误差"]["测量值小数位"]))
    sign = random.choice([-1, 1])
    target_percent = random.choice([5.0, 5.5, 6.0])
    results = []
    print(f"命中二氧化氮 0-20ppm 定向示值误差分支: 方向={'偏大' if sign > 0 else '偏小'}, 目标误差={target_percent}%")

    for row, standard, mpe_value in zip(rows, standards, mpes):
        if standard is None or mpe_value is None:
            raise ValueError(f"二氧化氮 0-20ppm 场景第 {row} 行数据不完整")
        measured_values = 生成定向相对误差测量值(standard, target_percent, sign, decimals, 3)
        actual_errors, group_error, _ = 计算示值误差组结果(standard, measured_values, "相对", range_info)
        if not (mpe_value * 0.3 <= abs(group_error) <= mpe_value * 0.8):
            raise ValueError(f"二氧化氮 0-20ppm 第 {row} 行定向误差未落入 3%~8%")
        for col, value in zip(measure_cols, measured_values):
            写入单元格值(sheet, row, col, value, decimals)
        results.append(
            {
                "行号": row,
                "标准值": standard,
                "测量值": measured_values,
                "误差方式": "相对",
                "误差值": actual_errors,
                "组误差值": group_error,
            }
        )
        print(f"示值误差第 {row} 行: 标准值={standard}, 误差方式=相对, 测量值={measured_values}, 单次误差={actual_errors}, 平均误差={group_error}")

    group_errors = [abs(item["组误差值"]) for item in results]
    if max(group_errors) - min(group_errors) > min(mpes) * 0.2 + 1e-12:
        raise ValueError("二氧化氮 0-20ppm 定向示值误差组未满足三行差值约束")
    return {"方向": sign, "数据行": results}


def 读取行列列表位置(section):
    rows = section.get("行")
    if rows is None:
        row = section.get("行号")
        rows = [row] if row is not None else []
    if not isinstance(rows, list):
        rows = [rows]
    measure_cols = section.get("测量值列")
    if measure_cols is None:
        measure_cols = section.get("测量值行", [])
    return rows, measure_cols


def 写入量程(sheet, section, range_info):
    写入单元格值(sheet, section["最小值"]["行"], section["最小值"]["列"], range_info["最小值"])
    写入单元格值(sheet, section["最大值"]["行"], section["最大值"]["列"], range_info["最大值"])


def 生成目标误差组(limit_metric, sign, rule):
    min_effective = rule["最小有效误差"]
    forbidden_interval = rule.get("禁用误差区间")
    if isinstance(forbidden_interval, (list, tuple)) and len(forbidden_interval) == 2:
        forbidden_lower = min(abs(float(forbidden_interval[0])), abs(float(forbidden_interval[1])))
        min_effective = max(min_effective, forbidden_lower)
    lower = min_effective if limit_metric > min_effective else max(limit_metric * 0.65, 0.01)
    lower = min(lower, limit_metric)

    preferred_lower = max(lower, limit_metric * 0.2)
    preferred_upper = max(preferred_lower, limit_metric * 0.8)
    preferred_ratio_range = rule.get("优先误差比例范围")
    forced_ratio_center = rule.get("目标误差比例中心")
    forced_ratio_half_span = float(rule.get("目标误差比例半宽", 0.1) or 0.1)
    if forced_ratio_center is not None:
        center = float(forced_ratio_center)
        preferred_ratio_range = [
            max(0.0, center - forced_ratio_half_span),
            min(1.0, center + forced_ratio_half_span),
        ]
    if isinstance(preferred_ratio_range, (list, tuple)) and len(preferred_ratio_range) == 2:
        ratio_lower = max(0.0, min(float(preferred_ratio_range[0]), float(preferred_ratio_range[1])))
        ratio_upper = max(ratio_lower, max(float(preferred_ratio_range[0]), float(preferred_ratio_range[1])))
        ratio_jitter = rule.get("比例浮动范围", [0.0, 0.0])
        if isinstance(ratio_jitter, (list, tuple)) and len(ratio_jitter) == 2:
            jitter_high = max(float(ratio_jitter[0]), float(ratio_jitter[1]))
            ratio_lower = max(0.0, ratio_lower + random.uniform(-jitter_high, jitter_high) * 0.35)
            ratio_upper = min(1.0, ratio_upper + random.uniform(-jitter_high, jitter_high))
            if ratio_upper < ratio_lower:
                ratio_lower, ratio_upper = ratio_upper, ratio_lower
            if ratio_upper - ratio_lower < 0.08:
                ratio_upper = min(1.0, ratio_lower + 0.08)
        range_lower = max(lower, limit_metric * ratio_lower)
        range_upper = min(limit_metric, limit_metric * ratio_upper)
        if range_upper >= range_lower:
            preferred_lower = range_lower
            preferred_upper = max(preferred_lower, range_upper)

    # 控制三次误差不要过度分散，同时保留一定随机性。
    base = random.uniform(preferred_lower, preferred_upper)
    max_group_ratio = 计算误差组最大离散比例(limit_metric, rule)
    discrete = min(
        limit_metric * rule["误差组离散系数"],
        limit_metric * max_group_ratio * random.uniform(0.35, 0.9),
        max(0.08, base * rule["误差组离散系数"] * random.uniform(0.9, 1.5)),
    )
    values = []
    for idx in range(3):
        skew = (idx - 1) * discrete * random.uniform(0.2, 0.8)
        jitter = random.uniform(-discrete * 0.7, discrete * 0.7)
        values.append(限制范围(base + skew + jitter, lower, limit_metric) * sign)
    values.sort(key=lambda item: abs(item))
    if sign > 0:
        values = [values[0], values[2], values[1]]
    else:
        values = [values[1], values[2], values[0]]
    return values


def 打散相同测量值(标准值, measured_values, 误差方式, range_info, sign, rule, limit_metric):
    decimals = int(rule["测量值小数位"])
    step = 1 / (10 ** decimals) if decimals > 0 else 1.0
    min_value_step = max(step, float(rule.get("最小测量值步差", 1)) * step)
    adjusted = [round(float(value), decimals) for value in measured_values]

    if len(set(adjusted)) >= 2:
        return adjusted

    step_unit = min_value_step
    signed_patterns = [
        [-1, 0, 1],
        [-1, 1, 2],
        [-2, -1, 1],
        [-2, 0, 2],
        [-1, 0, 0],
        [0, 0, 1],
        [-2, 0, 1],
        [-1, 1, 1],
        [-1, -1, 1],
    ]
    for raw_pattern in signed_patterns:
        candidate = []
        for index, offset_units in enumerate(raw_pattern):
            if sign < 0:
                offset_units = -offset_units
            candidate.append(round(adjusted[index] + offset_units * step_unit, decimals))
        valid, _, _ = 验证示值误差组(标准值, candidate, 误差方式, range_info, sign, rule, limit_metric)
        if valid and len(set(candidate)) >= 2:
            return candidate

    return adjusted


def 应用行级示值误差扰动(local_rule, gas_config, range_info, row):
    row_rule = local_rule.get("小量程行级扰动")
    if not isinstance(row_rule, dict):
        return local_rule
    gas_type = str(gas_config.get("气体类型", "")).strip().lower()
    allowed_gases = row_rule.get("适用气体")
    if isinstance(allowed_gases, (list, tuple)) and allowed_gases:
        normalized_allowed = {str(item).strip().lower() for item in allowed_gases}
    else:
        normalized_allowed = {"一氧化碳", "co"}
    if gas_type not in normalized_allowed:
        return local_rule
    max_range = float(range_info.get("最大值", 0) or 0)
    enable_limit = float(row_rule.get("启用量程上限", 0) or 0)
    if enable_limit > 0 and max_range > enable_limit:
        return local_rule

    patched = copy.deepcopy(local_rule)
    row_ratio_ranges = row_rule.get("行误差比例范围", {})
    row_jitter_ranges = row_rule.get("行比例浮动范围", {})
    if row in row_ratio_ranges:
        patched["优先误差比例范围"] = list(row_ratio_ranges[row])
    if row in row_jitter_ranges:
        patched["比例浮动范围"] = list(row_jitter_ranges[row])
    patched["误差组离散系数"] = max(float(patched.get("误差组离散系数", 0.18)), 0.24)
    return patched


def 计算示值误差组结果(标准值, 测量值组, 误差方式, range_info):
    actual_errors = [
        计算误差值(误差方式, 标准值, measured_value, range_info["最小值"], range_info["最大值"])
        for measured_value in 测量值组
    ]
    avg_measured = sum(float(value) for value in 测量值组) / len(测量值组) if 测量值组 else float(标准值)
    group_error = 计算误差值(误差方式, 标准值, avg_measured, range_info["最小值"], range_info["最大值"])
    return actual_errors, group_error, avg_measured


def 计算重复性结果(values):
    clean = [float(value) for value in values if value is not None]
    if len(clean) < 2:
        avg = clean[0] if clean else 0.0
        return 0.0, avg, 0.0
    avg = sum(clean) / len(clean)
    if avg == 0:
        return 0.0, avg, 0.0
    try:
        std = statistics.stdev(clean)
    except statistics.StatisticsError:
        return 0.0, avg, 0.0
    return abs(std / avg) * 100.0, avg, std


def 验证示值误差组(标准值, 测量值组, 误差方式, range_info, sign, rule, limit_metric):
    actual_errors, group_error, _ = 计算示值误差组结果(标准值, 测量值组, 误差方式, range_info)
    if len(set(round(float(value), int(rule.get("测量值小数位", 1))) for value in 测量值组)) < max(1, int(rule.get("最小不同测量值数", 1))):
        return False, actual_errors, group_error
    actual_signs = []
    for measured_value in 测量值组:
        diff = measured_value - 标准值
        actual_signs.append(1 if diff >= 0 else -1)

    if any(item != sign for item in actual_signs):
        return False, actual_errors, group_error

    abs_errors = [abs(item) for item in actual_errors]
    abs_group_error = abs(group_error)
    min_effective = min(rule["最小有效误差"], limit_metric)
    if abs_group_error > limit_metric:
        return False, actual_errors, group_error
    if abs_group_error < min_effective * 0.9:
        return False, actual_errors, group_error

    forbidden_interval = rule.get("禁用误差区间")
    if isinstance(forbidden_interval, (list, tuple)) and len(forbidden_interval) == 2:
        forbidden_lower = float(min(forbidden_interval))
        forbidden_upper = float(max(forbidden_interval))
        if forbidden_lower < group_error < forbidden_upper:
            return False, actual_errors, group_error

    error_span = max(actual_errors) - min(actual_errors)
    max_group_ratio = 计算误差组最大离散比例(limit_metric, rule)
    if error_span > max(rule["最小有效误差"], limit_metric * min(rule["误差组最大跨度系数"], max_group_ratio)):
        return False, actual_errors, group_error

    absolute_limit = abs(误差值转绝对偏差(误差方式, 标准值, limit_metric, range_info["最小值"], range_info["最大值"]))
    value_span = max(测量值组) - min(测量值组)
    if value_span > max(rule["最小有效误差"], absolute_limit * rule["测量值最大波动系数"]):
        return False, actual_errors, group_error

    return True, actual_errors, group_error


def 生成单行示值误差(标准值, 误差方式, mpe_value, range_info, rule):
    sign = random.choice([-1, 1])
    limit_metric = mpe_value * rule["mpe安全系数"]
    decimals = int(rule["测量值小数位"])
    step = 1 / (10 ** decimals) if decimals > 0 else 1.0
    quantized_metric_step = abs(计算误差值(误差方式, 标准值, 标准值 + step, range_info["最小值"], range_info["最大值"]))
    if 0 < quantized_metric_step <= max(mpe_value, limit_metric):
        limit_metric = max(limit_metric, min(quantized_metric_step, mpe_value))
    if limit_metric <= 0:
        return sign, [round(标准值, decimals)] * 3, [0.0, 0.0, 0.0], 0.0

    for _ in range(rule["最大尝试次数"]):
        target_errors = 生成目标误差组(limit_metric, sign, rule)
        measured_values = []
        for target_error in target_errors:
            absolute_offset = 误差值转绝对偏差(误差方式, 标准值, target_error, range_info["最小值"], range_info["最大值"])
            measured_values.append(round(标准值 + absolute_offset, rule["测量值小数位"]))
        measured_values = 打散相同测量值(标准值, measured_values, 误差方式, range_info, sign, rule, limit_metric)

        valid, actual_errors, group_error = 验证示值误差组(标准值, measured_values, 误差方式, range_info, sign, rule, limit_metric)
        if valid:
            return sign, measured_values, actual_errors, group_error

    fallback_patterns = (
        [0, 0, 0],
        [0, -1, 1],
        [-1, 0, 1],
        [0, 0, 1],
        [-1, 0, 0],
    )
    for ratio in (0.72, 0.58, 0.84):
        base_metric = max(min(rule["最小有效误差"], limit_metric), limit_metric * ratio)
        absolute_offset = abs(误差值转绝对偏差(误差方式, 标准值, base_metric, range_info["最小值"], range_info["最大值"]))
        base_steps = max(1, int(round(absolute_offset / step)))
        for pattern in fallback_patterns:
            measured_values = []
            for offset_steps in pattern:
                total_steps = max(1, base_steps + offset_steps)
                candidate = 标准值 + sign * total_steps * step
                measured_values.append(round(candidate, decimals))
            valid, actual_errors, group_error = 验证示值误差组(标准值, measured_values, 误差方式, range_info, sign, rule, limit_metric)
            if valid:
                return sign, measured_values, actual_errors, group_error

    raise ValueError(f"无法为标准值 {标准值} 生成满足要求的 {误差方式} 误差组")


def 生成示值误差(sheet, gas_config, rule_config, range_info):
    if 是否二氧化氮零到二十场景(gas_config, range_info):
        return 生成二氧化氮零到二十示值误差(sheet, gas_config, rule_config, range_info)
    section = gas_config["示值误差"]
    rows, measure_cols = 读取行列列表位置(section)
    standards = [读取单元格值(sheet, row, section["标准值列"]) for row in rows]
    formulas = [读取单元格公式(sheet, row, section["公式列"]) for row in rows]
    mpes = [读取单元格值(sheet, row, section["MPE列"]) for row in rows]
    outer_try_limit = max(1, int(rule_config["示值误差"].get("整组最大尝试次数", 24)))
    current_gas_type = str(gas_config.get("气体类型", "")).strip().lower()

    for _ in range(outer_try_limit):
        global_sign = random.choice([-1, 1])
        shared_ratio = None
        shared_ratio_range = section.get("全组目标误差比例范围")
        if isinstance(shared_ratio_range, (list, tuple)) and len(shared_ratio_range) == 2:
            ratio_low = max(0.0, min(float(shared_ratio_range[0]), float(shared_ratio_range[1])))
            ratio_high = min(1.0, max(float(shared_ratio_range[0]), float(shared_ratio_range[1])))
            shared_ratio = random.uniform(ratio_low, ratio_high)

        results = []
        success = True

        for index, row in enumerate(rows):
            standard = standards[index]
            if standard is None:
                results.append({"行号": row, "标准值": None, "测量值": [], "误差方式": "绝对"})
                continue

            error_mode = str(
                section.get("误差方式")
                or gas_config.get("误差方式")
                or 获取默认误差方式(gas_config.get("气体类型"))
                or 判断误差方式(formulas[index])
            )
            print(
                f"示值误差配置第 {row} 行: 脚本={os.path.abspath(__file__)}, "
                f"气体类型={gas_config.get('气体类型')}, 最终误差方式={error_mode}, 原始公式={formulas[index]}"
            )
            mpe_value = 解析MPE数值(mpes[index])
            if mpe_value is None:
                raise ValueError(f"示值误差第 {row} 行 MPE 无法解析: {mpes[index]}")
            history_key = 生成历史键(gas_config, range_info, row, mpe_value, "示值误差")

            local_rule = copy.deepcopy(rule_config["示值误差"])
            if "小数位数" in section:
                local_rule["测量值小数位"] = int(section["小数位数"])
            for extra_key in (
                "优先误差比例范围",
                "比例浮动范围",
                "小量程行级扰动",
                "最小有效误差",
                "误差组最大跨度系数",
                "测量值最大波动系数",
                "最小不同测量值数",
            ):
                if extra_key in section:
                    local_rule[extra_key] = copy.deepcopy(section[extra_key])
            exempt_gases = {str(item).strip().lower() for item in local_rule.get("禁用误差区间豁免气体", [])}
            if current_gas_type in exempt_gases:
                local_rule.pop("禁用误差区间", None)
                local_rule.pop("优先误差比例范围", None)
            local_rule = 应用行级示值误差扰动(local_rule, gas_config, range_info, row)
            if shared_ratio is not None:
                local_rule["目标误差比例中心"] = shared_ratio
                local_rule["目标误差比例半宽"] = float(section.get("全组组误差最大差值比例", 0.2)) / 2.0

            row_try_limit = max(1, int(local_rule.get("最大尝试次数", 200)))
            row_success = False
            for _row_try in range(row_try_limit):
                _, measured_values, actual_errors, group_error = 生成单行示值误差(float(standard), error_mode, mpe_value, range_info, local_rule)

                if measured_values:
                    row_sign = 1 if measured_values[0] - float(standard) >= 0 else -1
                    if row_sign != global_sign:
                        adjusted = []
                        for actual_error in actual_errors:
                            offset = 误差值转绝对偏差(error_mode, float(standard), abs(actual_error) * global_sign, range_info["最小值"], range_info["最大值"])
                            adjusted.append(round(float(standard) + offset, local_rule["测量值小数位"]))
                        valid, adjusted_errors, adjusted_group_error = 验证示值误差组(
                            float(standard),
                            adjusted,
                            error_mode,
                            range_info,
                            global_sign,
                            local_rule,
                            mpe_value * local_rule["mpe安全系数"],
                        )
                        if valid:
                            measured_values = adjusted
                            actual_errors = adjusted_errors
                            group_error = adjusted_group_error

                if 历史重复次数("示值误差组", history_key, tuple(measured_values)) >= 2:
                    continue

                abs_group_error = abs(group_error)
                if abs_group_error < mpe_value * 0.3 or abs_group_error > mpe_value * 0.8:
                    continue
                if 判定示值误差合格(group_error, mpe_value):
                    row_success = True
                    break

            if not row_success:
                success = False
                break

            results.append(
                {
                    "行号": row,
                    "标准值": float(standard),
                    "测量值": measured_values,
                    "误差方式": error_mode,
                    "误差值": actual_errors,
                    "组误差值": group_error,
                    "MPE值": mpe_value,
                    "小数位数": local_rule["测量值小数位"],
                }
            )

        valid_rows = [item for item in results if item.get("标准值") is not None]
        if not success or not valid_rows:
            continue

        abs_group_errors = [abs(item["组误差值"]) for item in valid_rows]
        span_limit = min(item["MPE值"] for item in valid_rows) * float(section.get("全组组误差最大差值比例", 0.2))
        if max(abs_group_errors) - min(abs_group_errors) > span_limit + 1e-12:
            continue

        for item in valid_rows:
            for col, value in zip(measure_cols, item["测量值"]):
                写入单元格值(sheet, item["行号"], col, value, item["小数位数"])
            print(
                f"示值误差第 {item['行号']} 行: 标准值={item['标准值']}, 误差方式={item['误差方式']}, "
                f"测量值={item['测量值']}, 单次误差={item['误差值']}, 平均误差={item['组误差值']}"
            )
            记录最近历史("示值误差组", 生成历史键(gas_config, range_info, item["行号"], item["MPE值"], "示值误差"), tuple(item["测量值"]))

        for item in valid_rows:
            item.pop("MPE值", None)
            item.pop("小数位数", None)
        return {"方向": global_sign, "数据行": results}

    raise ValueError("示值误差整组经过多次重试后仍无法满足组内统一偏差约束")


def 选择重复性参考行(示值误差结果, range_info, rule_config):
    valid_rows = [item for item in 示值误差结果["数据行"] if item["标准值"] is not None and item["测量值"]]
    if not valid_rows:
        raise ValueError("示值误差没有可供重复性使用的参考数据")
    target = range_info["最小值"] + (range_info["最大值"] - range_info["最小值"]) * rule_config["重复性"]["默认标准值比例"]
    return min(valid_rows, key=lambda item: abs(item["标准值"] - target))


def 构造重复性保底值(ref_values, count, decimals, step, min_span, max_span):
    center = round(sum(ref_values) / len(ref_values), decimals)
    max_offset_steps = max(1, int(round(max_span / step))) if max_span > 0 else 1
    min_offset_steps = max(1, int(round(min_span / step)))
    max_offset_steps = max(min_offset_steps, max_offset_steps)
    patterns = [
        [-1, 0, 1, 0, -1, 1],
        [0, 1, -1, 1, 0, -1],
        [-1, 1, 0, -1, 1, 0],
    ]

    for offset_steps in range(max_offset_steps, min_offset_steps - 1, -1):
        values = []
        pattern = random.choice(patterns)
        for index in range(count):
            direction = pattern[index % len(pattern)]
            values.append(round(center + direction * offset_steps * step, decimals))
        if len(set(values)) < 2:
            continue
        span = max(values) - min(values)
        if span + 1e-12 < min_span or span - 1e-12 > max_span:
            continue
        return values

    fallback = [round(center, decimals) for _ in range(count)]
    if count >= 2:
        fallback[0] = round(center - step, decimals)
        fallback[1] = round(center, decimals)
    if count >= 3:
        fallback[2] = round(center + step, decimals)
    return fallback


def 向众数收缩重复性(values, decimals, mpe_value):
    working = [round(float(value), decimals) for value in values if value is not None]
    if len(working) < 2:
        return working, 计算重复性百分比(working), "最近保底"

    step = 1 / (10 ** decimals) if decimals > 0 else 1.0
    best_values = list(working)
    best_percent = 计算重复性百分比(working)

    if mpe_value is not None and best_percent <= mpe_value:
        return best_values, best_percent, "严格"

    max_iterations = max(12, len(working) * 8)
    for _ in range(max_iterations):
        counts = {}
        for value in working:
            counts[value] = counts.get(value, 0) + 1
        mode_value = max(counts.items(), key=lambda item: (item[1], -abs(item[0] - sum(working) / len(working))))[0]

        farthest_index = None
        farthest_distance = -1.0
        for index, value in enumerate(working):
            distance = abs(value - mode_value)
            if distance > farthest_distance + 1e-12:
                farthest_distance = distance
                farthest_index = index

        if farthest_index is None or farthest_distance <= 0:
            break

        current = working[farthest_index]
        if abs(current - mode_value) <= step:
            working[farthest_index] = round(mode_value, decimals)
        elif current > mode_value:
            working[farthest_index] = round(current - step, decimals)
        else:
            working[farthest_index] = round(current + step, decimals)

        current_percent = 计算重复性百分比(working)
        if current_percent < best_percent:
            best_values = list(working)
            best_percent = current_percent
        if mpe_value is not None and current_percent <= mpe_value:
            return list(working), current_percent, "向众数收缩"

    return best_values, best_percent, "最近保底"


def 构造重复性测量值(ref_row, count, decimals, mpe_value=None, repeat_rule=None):
    ref_values = [round(float(value), decimals) for value in ref_row["测量值"] if value is not None]
    if not ref_values:
        raise ValueError("重复性参考行没有可用的测量值")

    repeat_rule = repeat_rule or 默认配置["生成规则"]["重复性"]
    unique_values = sorted(set(ref_values))
    mpe_safety = float(repeat_rule.get("mpe安全系数", 0.9))
    target_util_low, target_util_high = repeat_rule.get("目标MPE利用率范围", [0.2, 0.9])
    min_variation_steps = max(1, int(repeat_rule.get("最小变化步数", 1)))
    max_try_count = max(120, int(repeat_rule.get("最大尝试次数", 320)))
    min_distinct_values = max(2, int(repeat_rule.get("最小不同测量值数", 2)))
    step = 1 / (10 ** decimals) if decimals > 0 else 1.0
    center = sum(ref_values) / len(ref_values)
    min_span = min_variation_steps * step

    safe_mpe = None
    target_low_percent = 0.0
    target_high_percent = None
    if mpe_value is not None and mpe_value > 0 and abs(center) > 0:
        safe_mpe = mpe_value * mpe_safety
        target_low_percent = safe_mpe * float(target_util_low)
        target_high_percent = safe_mpe * float(target_util_high)

    candidate_groups = []
    quantized_patterns = [
        [-1, 0, 1, 0, -1, 1],
        [-1, -1, 0, 1, 1, 0],
        [-2, -1, 0, 1, 2, 0],
        [-2, -1, 1, 2, 0, 1],
    ]
    for pattern in quantized_patterns:
        for amplitude in (1, 2, 3):
            rotated = pattern[:]
            random.shuffle(rotated)
            values = []
            for index in range(count):
                center_shift = random.choice([0.0, 0.0, step, -step])
                values.append(round(center + center_shift + rotated[index % len(rotated)] * step * amplitude, decimals))

            if len(set(values)) < min_distinct_values:
                continue
            repeatability_percent = 计算重复性百分比(values)
            if repeatability_percent <= 0:
                continue
            if safe_mpe is not None:
                if repeatability_percent < target_low_percent or repeatability_percent > target_high_percent:
                    continue
                if repeatability_percent >= safe_mpe:
                    continue

            ref_distance = sum(abs(values[i] - ref_values[i % len(ref_values)]) for i in range(count)) / max(1, count)
            target_mid = (target_low_percent + target_high_percent) / 2.0 if target_high_percent is not None else repeatability_percent
            target_bias = abs(repeatability_percent - target_mid)
            span = max(values) - min(values)
            candidate_groups.append((values[:], target_bias, ref_distance, -len(set(values)), -span, repeatability_percent))

    for _ in range(max_try_count):
        working_refs = ref_values[:]
        random.shuffle(working_refs)
        if len(working_refs) < count:
            working_refs.extend(random.choices(ref_values, k=count - len(working_refs)))

        local_center = center + random.uniform(-step, step)
        spread_scale = random.uniform(0.35, 1.0)
        if safe_mpe is not None and abs(local_center) > 0:
            target_percent = random.uniform(target_low_percent, target_high_percent)
            sigma = abs(local_center) * target_percent / 100.0
            sigma = max(step * 0.5, sigma * spread_scale)
        else:
            sigma = max(step * 0.5, statistics.pstdev(ref_values) if len(ref_values) > 1 else step)

        values = []
        for index in range(count):
            ref_value = working_refs[index]
            mixed_center = ref_value * random.uniform(0.55, 0.85) + local_center * random.uniform(0.15, 0.45)
            candidate = random.gauss(mixed_center, sigma)
            pullback = (candidate - local_center) * random.uniform(0.08, 0.22)
            candidate = candidate - pullback
            values.append(round(candidate, decimals))

        if len(set(values)) < min_distinct_values:
            continue
        if abs(sum(values) / len(values) - center) > max(step * 2, abs(center) * 0.04):
            continue

        span = max(values) - min(values)
        if span + 1e-12 < min_span:
            continue

        repeatability_percent = 计算重复性百分比(values)
        if repeatability_percent <= 0:
            continue
        if safe_mpe is not None:
            if repeatability_percent < target_low_percent or repeatability_percent > target_high_percent:
                continue
            if repeatability_percent >= safe_mpe:
                continue

        ref_distance = sum(abs(values[i] - working_refs[i]) for i in range(count)) / max(1, count)
        target_mid = (target_low_percent + target_high_percent) / 2.0 if target_high_percent is not None else repeatability_percent
        target_bias = abs(repeatability_percent - target_mid)
        candidate_groups.append((values[:], target_bias, ref_distance, -len(set(values)), -span, repeatability_percent))

    if not candidate_groups:
        fallback_max_span = max(min_span * 3, step * 2)
        return 构造重复性保底值(ref_values, count, decimals, step, min_span, fallback_max_span)

    candidate_groups.sort(key=lambda item: (item[1], item[2], item[3], item[4], item[5]))
    best_bias = candidate_groups[0][1]
    tolerance = 0.12
    if target_high_percent is not None:
        tolerance = max(tolerance, (target_high_percent - target_low_percent) * 0.35)
    pool = [item for item in candidate_groups if item[1] <= best_bias + tolerance]
    pick_end = max(1, min(len(pool), 24))
    values, _, _, _, _, _ = random.choice(pool[:pick_end])
    return values


def 计算重复性百分比(values):
    percent, _, _ = 计算重复性结果(values)
    return percent


def 生成重复性(sheet, gas_config, rule_config, 示值误差结果, range_info):
    if 是否二氧化氮零到二十场景(gas_config, range_info):
        section = gas_config["重复性"]
        _, measure_cols = 读取行列列表位置(section)
        decimals = int(section.get("小数位数", rule_config["重复性"]["测量值小数位"]))
        values = [9.8, 9.9, 10.0, 10.1, 10.2, 10.3]
        random.shuffle(values)
        repeatability_percent, repeatability_avg, repeatability_std = 计算重复性结果(values)
        print("命中二氧化氮 0-20ppm 定向重复性分支")
        写入单元格值(sheet, section["行号"], section["标准值列"], 10.0, decimals)
        for col, value in zip(measure_cols, values):
            写入单元格值(sheet, section["行号"], col, value, decimals)
        print(
            f"重复性第 {section['行号']} 行: 参考示值误差第 9 行 "
            f"测量值={values}, 平均值={repeatability_avg:.4f}, 标准偏差={repeatability_std:.4f}, 重复性={repeatability_percent:.2f}%, 模式=定向"
        )
        return {
            "参考行": 9,
            "测量值": values,
            "重复性百分比": repeatability_percent,
            "平均值": repeatability_avg,
            "标准偏差": repeatability_std,
        }
    section = gas_config["重复性"]
    _, measure_cols = 读取行列列表位置(section)
    ref_row = 选择重复性参考行(示值误差结果, range_info, rule_config)
    local_repeat_rule = copy.deepcopy(rule_config["重复性"])
    for extra_key in ("目标MPE利用率范围", "最小变化步数", "最大尝试次数", "整组最大尝试次数", "mpe安全系数", "最小不同测量值数", "避免重复百分比步进"):
        if extra_key in section:
            local_repeat_rule[extra_key] = copy.deepcopy(section[extra_key])
    decimals = int(section.get("小数位数", local_repeat_rule["测量值小数位"]))
    mpe_value = 解析MPE数值(读取单元格值(sheet, section["行号"], section["MPE列"]))
    try_limit = max(1, int(local_repeat_rule.get("整组最大尝试次数", 36)))
    history_key = 生成历史键(gas_config, range_info, section["行号"], mpe_value, "重复性")
    history_tolerance = float(local_repeat_rule.get("避免重复百分比步进", 0.05))
    fallback_level = "严格"
    for _ in range(try_limit):
        values = 构造重复性测量值(ref_row, len(measure_cols), decimals, mpe_value, local_repeat_rule)
        values = [round(float(value), decimals) for value in values]
        repeatability_percent, repeatability_avg, repeatability_std = 计算重复性结果(values)
        if 历史重复次数("重复性百分比", history_key, round(repeatability_percent, 3), history_tolerance) >= 2:
            continue
        if 判定重复性合格(repeatability_percent, mpe_value):
            break
    else:
        values, repeatability_percent, fallback_level = 向众数收缩重复性(
            values,
            decimals,
            mpe_value,
        )
        values = [round(float(value), decimals) for value in values]
        repeatability_percent, repeatability_avg, repeatability_std = 计算重复性结果(values)
        print(
            f"警告: 重复性第 {section['行号']} 行严格生成失败，已回退到{fallback_level}模式，"
            f" 当前重复性={repeatability_percent:.2f}% , MPE={mpe_value}"
        )

    写入单元格值(sheet, section["行号"], section["标准值列"], round(ref_row["标准值"], decimals), decimals)
    for col, value in zip(measure_cols, values):
        写入单元格值(sheet, section["行号"], col, value, decimals)

    if mpe_value is not None and repeatability_percent > mpe_value:
        print(f"警告: 重复性计算值 {repeatability_percent:.2f}% 超过 MPE {mpe_value}%")

    print(
        f"重复性第 {section['行号']} 行: 参考示值误差第 {ref_row['行号']} 行, "
        f"测量值={values}, 平均值={repeatability_avg:.4f}, 标准偏差={repeatability_std:.4f}, 重复性={repeatability_percent:.2f}%, 模式={fallback_level}"
    )
    记录最近历史("重复性百分比", history_key, round(repeatability_percent, 3))
    return {
        "参考行": ref_row["行号"],
        "测量值": values,
        "重复性百分比": repeatability_percent,
        "平均值": repeatability_avg,
        "标准偏差": repeatability_std,
    }


def 解析响应时间规则(mpe_text, rule_config):
    compact = 规范化文本(mpe_text).replace(" ", "").lower()
    for item in rule_config["响应时间"]["规则"]:
        if item["匹配"].lower() in compact:
            return item["生成范围"], item["组内最大差值"]

    numeric = 解析MPE数值(mpe_text)
    if numeric is not None:
        if numeric <= 30:
            return [8.0, 12.0], 3.0
        if numeric >= 180:
            return [50.0, 70.0], 15.0
        if numeric <= 60:
            return [15.0, 25.0], 5.0

    return rule_config["响应时间"]["默认范围"], rule_config["响应时间"]["默认组内最大差值"]


def 生成响应时间值组(value_range, max_diff, decimals):
    low, high = value_range
    center_low = low + max_diff / 2.0
    center_high = high - max_diff / 2.0
    center = (low + high) / 2.0 if center_low > center_high else random.uniform(center_low, center_high)
    values = [限制范围(center + random.uniform(-max_diff / 2.0, max_diff / 2.0), low, high) for _ in range(3)]
    if max(values) - min(values) > max_diff:
        values.sort()
        values[2] = values[0] + max_diff
    return [round(value, decimals) for value in values]


def 计算响应时间结果(values):
    clean = [float(value) for value in values if value is not None]
    if not clean:
        return 0.0, 0.0
    avg = sum(clean) / len(clean)
    spread = max(clean) - min(clean) if len(clean) >= 2 else 0.0
    return avg, spread


def 判定示值误差合格(group_error, mpe_value):
    if mpe_value is None:
        return True
    return abs(float(group_error)) <= float(mpe_value)


def 判定重复性合格(repeatability_percent, mpe_value):
    if mpe_value is None:
        return True
    return float(repeatability_percent) <= float(mpe_value)


def 判定响应时间合格(avg_value, spread, value_range, max_diff):
    low, high = value_range
    return low <= avg_value <= high and spread <= max_diff


def 生成响应时间(sheet, gas_config, rule_config):
    section = gas_config["响应时间"]
    _, measure_cols = 读取行列列表位置(section)
    mpe_text = 读取单元格值(sheet, section["行号"], section["MPE列"])
    value_range, max_diff = 解析响应时间规则(mpe_text, rule_config)
    decimals = int(section.get("小数位数", rule_config["响应时间"]["测量值小数位"]))
    try_limit = max(1, int(rule_config["响应时间"].get("最大尝试次数", 80)))
    for _ in range(try_limit):
        values = 生成响应时间值组(value_range, max_diff, decimals)
        avg, spread = 计算响应时间结果(values)
        if 判定响应时间合格(avg, spread, value_range, max_diff):
            break
    else:
        raise ValueError(f"响应时间第 {section['行号']} 行经过多次重试后仍无法满足 Excel 判定口径")

    for col, value in zip(measure_cols, values):
        写入单元格值(sheet, section["行号"], col, value, decimals)
    print(f"响应时间第 {section['行号']} 行: 技术要求={mpe_text}, 测量值={values}, 平均值={avg:.2f}, 组内差值={spread:.2f}")
    return {"测量值": values, "平均值": avg, "组内差值": spread}


def 构建运行配置(args):
    config = copy.deepcopy(默认配置)
    if isinstance(args, dict):
        if isinstance(args.get("总配置"), dict):
            config = 深合并(config, args["总配置"])
        if isinstance(args.get("配置"), dict):
            config = 深合并(config, args["配置"])
    return config


def 规范化气体配置项(item):
    config_item = copy.deepcopy(item)
    if "示值误差" in config_item:
        section = config_item["示值误差"]
        if "测量值行" in section and "测量值列" not in section:
            section["测量值列"] = section["测量值行"]
        if "行号" in section and "行" not in section:
            section["行"] = [section["行号"]]
    for key in ("重复性", "响应时间"):
        if key in config_item:
            section = config_item[key]
            if "测量值行" in section and "测量值列" not in section:
                section["测量值列"] = section["测量值行"]
    return config_item


def 获取手动配置(args):
    if not isinstance(args, dict):
        return None
    for key in ("手动配置", "位置配置", "项目配置", "气体配置"):
        value = args.get(key)
        if isinstance(value, dict):
            return 规范化气体配置项(value)
    return None


def 获取气体类型(args):
    if not isinstance(args, dict):
        return None
    for key in ("气体类型", "仪器类型", "仪器关键字", "instrument_type", "instrument_keyword"):
        value = args.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def 获取测量范围参数(args):
    if not isinstance(args, dict):
        return None
    for key in ("measurement_range", "measurement_range_str", "range_str", "测量范围", "range"):
        value = args.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def 判断是否二氧化氮模板场景(sheet, gas_config, range_info):
    gas_type = str(gas_config.get("气体类型", "")).strip().lower()
    if gas_type in {"二氧化氮", "no2"}:
        return True
    try:
        if float(range_info.get("最小值", 0) or 0) != 0 or float(range_info.get("最大值", 0) or 0) != 20:
            return False
    except Exception:
        return False

    try:
        standards = [读取单元格值(sheet, row, "B") for row in (8, 9, 10)]
        normalized = [None if value is None else round(float(value), 1) for value in standards]
        return normalized == [4.0, 10.0, 16.0]
    except Exception:
        return False


def 应用模板场景特调(sheet, config, gas_config, range_info):
    if not 判断是否二氧化氮模板场景(sheet, gas_config, range_info):
        return gas_config

    no2_config = None
    for item in config.get("气体配置列表", []):
        if str(item.get("气体类型", "")).strip().lower() in {"二氧化氮", "no2"}:
            no2_config = 规范化气体配置项(item)
            break
    if not no2_config:
        return gas_config

    merged = 深合并(gas_config, no2_config)
    merged["气体类型"] = "二氧化氮"
    print("检测到 0-20ppm 二氧化氮模板特征，已强制套用二氧化氮配置。")
    return merged


def 选择气体配置(config, gas_type, measurement_range_str):
    manual_config = None
    candidates = []
    if gas_type:
        candidates.append(gas_type.lower())
    if measurement_range_str:
        candidates.append(规范化文本(measurement_range_str).lower())

    for item in config["气体配置列表"]:
        config_item = 规范化气体配置项(item)
        keys = [str(config_item.get("气体类型", "")).lower()]
        keys.extend(str(keyword).lower() for keyword in config_item.get("关键字", []))
        for source in candidates:
            if any(keyword and keyword in source for keyword in keys):
                return config_item["气体类型"], config_item

    if config["气体配置列表"]:
        first_item = 规范化气体配置项(config["气体配置列表"][0])
        return first_item["气体类型"], first_item
    return "未命名", {}


def 解析最终气体配置(config, args, measurement_range_str):
    manual_config = 获取手动配置(args)
    if manual_config:
        gas_type = manual_config.get("气体类型") or 获取气体类型(args) or "手动配置"
        base_name, base_config = 选择气体配置(config, gas_type, measurement_range_str)
        return gas_type, 深合并(base_config, manual_config)
    return 选择气体配置(config, 获取气体类型(args), measurement_range_str)


def 获取Excel对象(args):
    excel_obj = None
    if isinstance(args, dict):
        excel_obj = args.get("excel_obj")
        if not excel_obj:
            for value in args.values():
                if not isinstance(value, (str, dict, list, tuple)):
                    excel_obj = value
                    break

    excel_obj = 规范化Excel对象(excel_obj, allow_active_fallback=False)
    if excel_obj:
        return excel_obj

    if xbot is not None:
        print("尝试自动获取当前激活的 Excel 窗口 (xbot)...")
        for _ in range(3):
            try:
                excel_obj = xbot.app.excel.get_active_workbook()
                excel_obj = 规范化Excel对象(excel_obj, allow_active_fallback=True)
                if excel_obj:
                    return excel_obj
            except Exception:
                pass
            sleep(1)

    try:
        import win32com.client

        xl_app = win32com.client.GetActiveObject("Excel.Application")
        workbook = xl_app.ActiveWorkbook
        if workbook:
            return Win32WorkbookAdapter(workbook)
    except Exception as e:
        print(f"Win32 COM 获取 Excel 失败: {e}")
    return None


def 激活原始记录工作表(excel_obj):
    sheet_name = "原始记录"

    try:
        if hasattr(excel_obj, "activate_sheet"):
            if excel_obj.activate_sheet(sheet_name):
                print(f"已切换到工作表: {sheet_name}")
                return True

        workbook = 安全取属性(excel_obj, "wb")
        if workbook:
            try:
                workbook.Worksheets(sheet_name).Activate()
                print(f"已切换到工作表: {sheet_name}")
                return True
            except Exception:
                try:
                    workbook.Sheets(sheet_name).Activate()
                    print(f"已切换到工作表: {sheet_name}")
                    return True
                except Exception:
                    pass
    except Exception as e:
        print(f"切换工作表失败: {e}")

    print(f"未切换到工作表 {sheet_name}，继续使用当前工作表")
    return False


def 处理校准数据(sheet, measurement_range_str, config, gas_config):
    range_info = 解析测量范围(measurement_range_str, config)
    if not range_info:
        return f"错误：无法解析测量范围: {measurement_range_str}"
    normalized_range_text = 规范化文本(measurement_range_str).lower()
    if (
        ("二氧化氮" in normalized_range_text or "no2" in normalized_range_text)
        and float(range_info.get("最小值", 0) or 0) == 0
        and float(range_info.get("最大值", 0) or 0) == 20
    ):
        gas_config["强制定向场景"] = "二氧化氮0-20"
        print("已根据传入测量范围强制启用二氧化氮 0-20ppm 定向场景。")
    gas_config = 应用模板场景特调(sheet, config, gas_config, range_info)

    print("=" * 60)
    print("开始处理报警器校准数据")
    print("=" * 60)
    print(f"当前脚本: {os.path.abspath(__file__)}")
    print(f"气体类型: {gas_config['气体类型']}")
    print(f"测量范围: {range_info['最小值']} - {range_info['最大值']} {range_info['单位']}")

    写入量程(sheet, gas_config["量程写入"], range_info)
    indication_result = 生成示值误差(sheet, gas_config, config["生成规则"], range_info)
    repeatability_result = 生成重复性(sheet, gas_config, config["生成规则"], indication_result, range_info)
    response_time_result = 生成响应时间(sheet, gas_config, config["生成规则"])

    print(f"示值误差方向: {'整体偏大' if indication_result['方向'] > 0 else '整体偏小'}")
    print(f"重复性参考行: {repeatability_result['参考行']}")
    print(f"响应时间结果: {response_time_result['测量值']}")
    print("=" * 60)
    print("报警器校准数据处理完成")
    print("=" * 60)
    return "执行完成"


def 运行校准(excel_obj, measurement_range_str, config, gas_config):
    try:
        激活原始记录工作表(excel_obj)
        sheet = excel_obj.get_active_sheet() if hasattr(excel_obj, "get_active_sheet") else 安全取属性(excel_obj, "active_sheet", excel_obj)
        return 处理校准数据(sheet, measurement_range_str, config, gas_config)
    except Exception as e:
        import traceback

        error_msg = f"执行出错: {e}\n{traceback.format_exc()}"
        print(error_msg)
        return error_msg


def main(args):
    print("版本: NO2-0-20-20260411-2207")
    measurement_range_str = 获取测量范围参数(args)
    if not measurement_range_str:
        return "错误：未提供测量范围参数，请传入 measurement_range 或 测量范围。"

    excel_obj = 获取Excel对象(args)
    if not excel_obj:
        return "错误：无法获取 Excel 对象，请确认影刀已传入 excel_obj 或当前 Excel 已打开。"

    config = 构建运行配置(args)
    config_name, gas_config = 解析最终气体配置(config, args, measurement_range_str)

    print(f"接收到的参数: {list(args.keys()) if isinstance(args, dict) else []}")
    print(f"测量范围参数: {measurement_range_str}")
    print(f"当前配置来源: {config_name}")
    return 运行校准(excel_obj, measurement_range_str, config, gas_config)
