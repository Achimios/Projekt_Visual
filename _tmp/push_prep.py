import subprocess, os

REPO = r"C:\Users\Administrator\Desktop\Projekt_Visual"
os.chdir(REPO)

MAX = 2 * 1024 * 1024
out = subprocess.run(["git", "diff", "--cached", "--name-only", "-z"], capture_output=True)
names = [n for n in out.stdout.decode("utf-8", "surrogateescape").split("\0") if n]

big = []
for n in names:
    try:
        if os.path.isfile(n) and os.path.getsize(n) > MAX:
            big.append(n)
    except OSError:
        pass

if big:
    subprocess.run(["git", "reset", "-q", "--"] + big, check=True)
print("drop staged files over 2MB: %d" % len(big))
for n in sorted(big, key=lambda x: -os.path.getsize(x))[:30]:
    print("  %8.1f MB  %s" % (os.path.getsize(n) / 1048576, n))

out = subprocess.run(["git", "diff", "--cached", "--name-only", "-z"], capture_output=True)
names = [n for n in out.stdout.decode("utf-8", "surrogateescape").split("\0") if n]
total = 0
for n in names:
    try:
        if os.path.isfile(n):
            total += os.path.getsize(n)
    except OSError:
        pass
print("\nfinal staged: %d files, %.2f MB" % (len(names), total / 1048576))
