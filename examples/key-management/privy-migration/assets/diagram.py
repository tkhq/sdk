import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

BLACK = "#000000"
GRAY = "#555555"

fig, ax = plt.subplots(figsize=(9.5, 11), dpi=200)
ax.set_xlim(0, 9.5)
ax.set_ylim(0, 11)
ax.axis("off")
fig.patch.set_facecolor("white")

# Title
ax.text(4.75, 10.5, "Privy \u2192 Turnkey migration",
        ha="center", va="center", fontsize=22, fontweight="bold", color=BLACK)
ax.text(4.75, 10.02, "Direct server-side key import over a shared HPKE suite",
        ha="center", va="center", fontsize=12, color=GRAY)

CX = 4.75
BW = 6.2
BH = 1.15

def step(y, num, title, sub):
    x = CX - BW/2
    p = FancyBboxPatch((x, y), BW, BH,
                       boxstyle="round,pad=0.02,rounding_size=0.1",
                       linewidth=2.0, edgecolor=BLACK, facecolor="white", zorder=3)
    ax.add_patch(p)
    ax.text(x + 0.55, y + BH/2, str(num), ha="center", va="center",
            fontsize=17, fontweight="bold", color="white", zorder=5,
            bbox=dict(boxstyle="circle,pad=0.35", fc=BLACK, ec=BLACK))
    ax.text(x + 1.15, y + BH*0.63, title, ha="left", va="center",
            fontsize=13.5, fontweight="bold", color=BLACK, zorder=5)
    ax.text(x + 1.15, y + BH*0.27, sub, ha="left", va="center",
            fontsize=10, color=GRAY, zorder=5)

def arrow(y_top, y_bot):
    a = FancyArrowPatch((CX, y_top), (CX, y_bot),
                        arrowstyle="-|>", mutation_scale=22,
                        linewidth=2.2, color=BLACK, zorder=2)
    ax.add_patch(a)

ys = [8.35, 6.55, 4.75, 2.95]

step(ys[0], 1, "Turnkey issues a target key",
     "initImportPrivateKey \u2014 enclave returns a signed encryption key (TEK)")
arrow(ys[0], ys[1] + BH)

step(ys[1], 2, "Privy exports the wallet key",
     "encrypted to the target key; never leaves in plaintext")
arrow(ys[1], ys[2] + BH)

step(ys[2], 3, "Script re-encrypts to the enclave",
     "decrypt + re-encrypt happens in memory only")
arrow(ys[2], ys[3] + BH)

step(ys[3], 4, "Turnkey imports the key",
     "importPrivateKey \u2014 enclave decrypts inside the TEE")

ax.text(CX, 2.15, "Shared HPKE suite: DHKEM(P-256, HKDF-SHA256) / HKDF-SHA256 / ChaCha20-Poly1305",
        ha="center", va="center", fontsize=9.5, color=GRAY, family="monospace")
ax.text(CX, 1.7, "The plaintext key is never written to disk.",
        ha="center", va="center", fontsize=10.5, color=BLACK, style="italic")

plt.tight_layout()
plt.savefig("migration-flow.png", dpi=200, bbox_inches="tight",
            facecolor="white", pad_inches=0.3)
print("saved")
