#!/usr/bin/env python3
"""Fix corrupted AITrader.tsx by removing garbage lines"""

file_path = 'src/app/components/AITrader.tsx'

# Read all lines
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

total_lines = len(lines)
print(f"📖 Total lines: {total_lines}")

# Lines to remove (Python uses 0-based index, so subtract 1)
# Line 457-459: corrupted garbage
# Line 513-529: duplicated code block
corrupted_ranges = [
    (456, 459),  # lines 457-459  
    (512, 529),  # lines 513-529
]

lines_to_remove = set()
for start, end in corrupted_ranges:
    for i in range(start, end):
        lines_to_remove.add(i)

print(f"🗑️  Removing {len(lines_to_remove)} corrupted lines")

# Create new list without corrupted lines
fixed_lines = [line for i, line in enumerate(lines) if i not in lines_to_remove]

print(f"✅ New total: {len(fixed_lines)} lines")

# Write fixed file
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(fixed_lines)

print(f"✨ File fixed! Removed lines: {sorted([i+1 for i in lines_to_remove])}")
