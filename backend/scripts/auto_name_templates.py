﻿﻿﻿import os
import re
import sys
from dataclasses import dataclass
from typing import Dict, Iterable, List

from openpyxl import load_workbook
from openpyxl.workbook.defined_name import DefinedName

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from extract_header_positions import export_csv, export_json, extract  # noqa: E402


NAME_PREFIX = "EX_"


def p(*args, sep=" ", end="\n", file=None):
    out = file or sys.stdout
    msg = sep.join(str(a) for a in args)
    enc = getattr(out, "encoding", None) or "utf-8"
    safe = msg.encode(enc, errors="replace").decode(enc, errors="replace")
    out.write(safe + end)


@dataclass
class ProcessResult:
    file_path: str
    success: bool
    json_path: str = ""
    csv_path: str = ""
    defined_name_count: int = 0
    removed_name_count: int = 0
    error: str = ""


def clean_name(name: str) -> str:
    text = "" if name is None else str(name)
    text = text.replace("\r", " ").replace("\n", " ").strip()
    text = re.sub(r"^[一二三四五六七八九十\d]+[、\.\-\s]*", "", text)
    text = re.sub(r"[\(（].*?[\)）]", "", text)
    text = re.sub(r"[^\u4e00-\u9fa5a-zA-Z0-9]", "", text)
    if not text:
        text = "X"
    if text[0].isdigit():
        text = "N" + text
    return text


class DefinedNameBuilder:
    def __init__(self, prefix: str = NAME_PREFIX):
        self.prefix = prefix

    def build(self, extracted: Dict, sheet_name: str) -> List[DefinedName]:
        defined_names: List[DefinedName] = []
        used: Dict[str, int] = {}

        for section in extracted.get("sections", []):
            section_part = clean_name(section.get("section", ""))
            for record in section.get("records", []):
                header_part = clean_name(record.get("header", ""))
                for slot in record.get("slots", []):
                    slot_part = clean_name(slot.get("slot", ""))
                    for index, item in enumerate(slot.get("items", []), 1):
                        cell_ref = item.get("cell", "")
                        if not cell_ref:
                            continue
                        base_name = f"{self.prefix}{section_part}_{header_part}_{slot_part}_{index}"[:240]
                        used[base_name] = used.get(base_name, 0) + 1
                        final_name = base_name if used[base_name] == 1 else f"{base_name}_{used[base_name]}"
                        defined_names.append(DefinedName(final_name, attr_text=self._cell_to_attr_text(sheet_name, cell_ref)))

        return defined_names

    def clear_existing(self, workbook) -> int:
        removed = 0
        for name in list(workbook.defined_names.keys()):
            if name.startswith(self.prefix):
                del workbook.defined_names[name]
                removed += 1
        return removed

    @staticmethod
    def _cell_to_attr_text(sheet_name: str, cell_ref: str) -> str:
        match = re.match(r"^([A-Z]+)(\d+)$", cell_ref)
        if not match:
            raise ValueError(f"Invalid cell ref: {cell_ref}")
        col, row = match.groups()
        return f"'{sheet_name}'!${col}${row}"


class BatchTemplateProcessor:
    def __init__(self, directory: str):
        self.directory = directory
        self.name_builder = DefinedNameBuilder()

    def run(self) -> List[ProcessResult]:
        results: List[ProcessResult] = []
        for file_path in self.iter_excel_files():
            results.append(self.process_file(file_path))
        return results

    def iter_excel_files(self) -> Iterable[str]:
        if not os.path.exists(self.directory):
            os.makedirs(self.directory)
            return []
        files = [
            os.path.join(self.directory, name)
            for name in os.listdir(self.directory)
            if name.endswith(".xlsx") and not name.startswith("~$")
        ]
        return sorted(files)

    def process_file(self, file_path: str) -> ProcessResult:
        p(f"\n>>> 正在处理: {os.path.basename(file_path)}")
        try:
            workbook = load_workbook(file_path, data_only=False)
            worksheet = workbook.active
            extracted = extract(worksheet)
            base_path = os.path.splitext(file_path)[0]
            json_path = export_json(extracted, base_path)
            csv_path = export_csv(extracted, base_path)

            removed = self.name_builder.clear_existing(workbook)
            defined_names = self.name_builder.build(extracted, worksheet.title)
            for defined_name in defined_names:
                workbook.defined_names.add(defined_name)

            workbook.save(file_path)

            p(f"  工作表: {worksheet.title}")
            p(f"  [结构化提取] {json_path}")
            p(f"  [CSV导出] {csv_path}")
            p(f"  [名称注入] 清理 {removed} 个，新增 {len(defined_names)} 个")

            return ProcessResult(
                file_path=file_path,
                success=True,
                json_path=json_path,
                csv_path=csv_path,
                defined_name_count=len(defined_names),
                removed_name_count=removed,
            )
        except Exception as exc:
            p(f"--- 失败: {exc} ---")
            return ProcessResult(file_path=file_path, success=False, error=str(exc))


def main(directory: str) -> None:
    processor = BatchTemplateProcessor(directory)
    files = list(processor.iter_excel_files())
    if not files:
        p(f"目录 {directory} 中未发现 .xlsx 文件。")
        return

    p(f"开始批量处理 {len(files)} 个文件...")
    results = [processor.process_file(file_path) for file_path in files]

    success_count = sum(1 for item in results if item.success)
    failure_count = len(results) - success_count
    p(f"\n处理完成: 成功 {success_count} 个，失败 {failure_count} 个")
    for item in results:
        if not item.success:
            p(f"  [失败] {os.path.basename(item.file_path)} -> {item.error}")


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    target_dir = os.path.join(base_dir, "templates_to_process")
    if len(sys.argv) > 1:
        target_dir = sys.argv[1]
    main(target_dir)
