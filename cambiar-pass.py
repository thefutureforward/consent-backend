# Cambia la contrasena del dashboard. Uso: py cambiar-pass.py admin MiClaveNueva
import sys, sqlite3, secrets, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from backend import hash_pw, DB, now
user, pw = sys.argv[1], sys.argv[2]
salt = secrets.token_hex(16)
c = sqlite3.connect(DB)
n = c.execute("UPDATE users SET pw_hash=?, salt=? WHERE username=?", (hash_pw(pw, salt), salt, user)).rowcount
if not n:
    c.execute("INSERT INTO users VALUES(?,?,?,?)", (user, hash_pw(pw, salt), salt, now()))
    print("usuario creado:", user)
else:
    print("contrasena actualizada:", user)
c.execute("DELETE FROM sessions WHERE username=?", (user,))   # cierra sesiones abiertas
c.commit(); c.close()
