#!/usr/bin/env python3
"""rembg wrapper - bypasses CLI import issues"""
import sys
from pathlib import Path

# Import only the core function, not the CLI
from rembg.bg import remove
from PIL import Image

def main():
    if len(sys.argv) != 3:
        print("Usage: rembg-wrapper.py <input> <output>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    with open(input_path, 'rb') as f:
        input_data = f.read()

    output_data = remove(input_data)

    with open(output_path, 'wb') as f:
        f.write(output_data)

if __name__ == "__main__":
    main()
