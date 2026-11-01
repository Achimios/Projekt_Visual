import sys
from pathlib import Path
from PIL import Image

def split_rg(filepath: Path):
    filepath = Path(str(filepath).strip('"').strip("'"))
    if not filepath.exists():
        print(f"❌ 文件不存在: {filepath}")
        return

    img = Image.open(filepath).convert("RGBA")
    r, g, b, a = img.split()

    out_metallic = filepath.parent / "metallic_01.png"
    out_roughness = filepath.parent / "roughness_01.png"

    r.save(out_metallic)
    g.save(out_roughness)
    print(f"✅ 完成")
    print(f"   Metallic : {out_metallic}")
    print(f"   Roughness: {out_roughness}")


if __name__ == "__main__":
    # 1) 命令行直接带参数（拖到脚本图标上用）
    if len(sys.argv) >= 2:
        for arg in sys.argv[1:]:
            split_rg(Path(arg))
        input("\n按回车退出...")
        sys.exit(0)

    # 2) 先运行脚本，再把图片拖进终端窗口
    print("把图片拖进这个窗口，然后按回车（可拖多张，空格分开）：")
    while True:
        raw = input("> ").strip()
        if not raw:
            print("⚠️ 没读到路径，重新拖入图片再回车")
            continue
        # 支持一次拖多张
        import re
        files = re.findall(r'"[^"]+"|\'[^\']+\'|\S+', raw)
        for f in files:
            split_rg(Path(f.strip('"').strip("'")))
        break
    input("\n按回车退出...")
