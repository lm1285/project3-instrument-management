# -*- coding: utf-8 -*-
import os
import sys

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def print_header():
    print("=" * 50)
    print("       Excel 模板批量处理工具")
    print("=" * 50)
    print()

def print_menu():
    print("请选择功能:")
    print()
    print("  [1] 批量处理模板 - 自动注入名称管理器锚点")
    print("  [2] 分析模板结构 - 识别合并单元格和内容")
    print("  [3] 退出")
    print()

def run_auto_name_templates():
    script_path = os.path.join(os.path.dirname(__file__), "auto_name_templates.py")
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    target_dir = os.path.join(base_dir, "templates_to_process")
    
    print(f"\n正在执行: 批量处理模板")
    print(f"目标目录: {target_dir}")
    print("-" * 50)
    
    import subprocess
    result = subprocess.run([sys.executable, script_path, target_dir], capture_output=False)
    
    print("-" * 50)
    input("\n按回车键返回主菜单...")

def run_analyze_template():
    script_path = os.path.join(os.path.dirname(__file__), "analyze_template.py")
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    target_dir = os.path.join(base_dir, "templates_to_process")
    
    files = []
    if os.path.exists(target_dir):
        files = [f for f in os.listdir(target_dir) if f.endswith(".xlsx") and not f.startswith("~$")]
    
    if not files:
        print(f"\n目录 {target_dir} 中没有发现 .xlsx 文件。")
        input("\n按回车键返回主菜单...")
        return
    
    print(f"\n可用的模板文件:")
    for i, f in enumerate(files, 1):
        print(f"  [{i}] {f}")
    print()
    
    try:
        choice = int(input("请选择要分析的文件编号: "))
        if 1 <= choice <= len(files):
            target_file = os.path.join(target_dir, files[choice - 1])
            
            print(f"\n正在分析: {files[choice - 1]}")
            print("-" * 50)
            
            import subprocess
            result = subprocess.run([sys.executable, script_path, target_file], capture_output=False)
            
            print("-" * 50)
        else:
            print("无效的选择")
    except ValueError:
        print("请输入有效的数字")
    
    input("\n按回车键返回主菜单...")

def main():
    while True:
        clear_screen()
        print_header()
        print_menu()
        
        try:
            choice = input("请输入选项 [1-3]: ").strip()
            
            if choice == "1":
                run_auto_name_templates()
            elif choice == "2":
                run_analyze_template()
            elif choice == "3":
                print("\n感谢使用，再见！")
                break
            else:
                print("\n无效选项，请重新选择")
                input("按回车键继续...")
        except KeyboardInterrupt:
            print("\n\n程序已退出")
            break
        except Exception as e:
            print(f"\n发生错误: {e}")
            input("按回车键继续...")

if __name__ == "__main__":
    main()
