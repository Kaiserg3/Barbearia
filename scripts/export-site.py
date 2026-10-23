"""Export the complete website previews after an intentional publish build."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent.parent
light = (root / "dist/ABRIR-BARBEARIA.html").read_bytes()
complete = (root / "dist/BRAVO-Barbearia.html").read_bytes()

if b'O site est\xc3\xa1 carregando' in light:
    raise SystemExit("A exportação precisa conter a página completa.")
if b'id="inicio"' not in light or b'type="module"' in light:
    raise SystemExit("A página principal precisa abrir sem um servidor de módulos.")

outputs = {
    "index.html": light,
    "ABRIR-BARBEARIA.html": light,
    "docs/index.html": light,
    "demo/BRAVO-Barbearia.html": complete,
}
for relative, contents in outputs.items():
    destination = root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(contents)
    destination.chmod(0o644)

archive = root / "downloads/BRAVO-Barbearia.zip"
archive.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(archive, "w", compression=ZIP_DEFLATED) as bundle:
    bundle.writestr("ABRIR-BARBEARIA.html", complete)
with ZipFile(archive) as bundle:
    if bundle.testzip() is not None:
        raise SystemExit("Falha ao verificar o pacote de download.")
    if bundle.read("ABRIR-BARBEARIA.html") != complete:
        raise SystemExit("O pacote de download não corresponde ao site completo.")
archive.chmod(0o644)

print("Página completa exportada para index.html, ABRIR-BARBEARIA.html e docs/index.html.")
print("Entrada de desenvolvimento preservada em web/index.html.")
