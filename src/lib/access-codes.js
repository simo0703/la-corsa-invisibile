// Validazione codici d'accesso. Query sempre parametrizzate: mai
// concatenare l'input dell'utente nella query (rischio injection).

export async function verificaCodice(db, code) {
  const row = await db
    .prepare("SELECT id, used_at, room_id FROM access_codes WHERE code = ?")
    .bind(code)
    .first();
  if (!row) return { valido: false, motivo: "codice_inesistente" };
  if (row.used_at) return { valido: false, motivo: "codice_gia_usato", room_id: row.room_id };
  return { valido: true, id: row.id };
}

export async function consumaCodice(db, code, roomId) {
  await db
    .prepare("UPDATE access_codes SET used_at = datetime('now'), room_id = ? WHERE code = ?")
    .bind(roomId, code)
    .run();
}

export async function generaCodici(db, quantita) {
  const codici = [];
  for (let i = 0; i < quantita; i++) {
    const code = crypto.randomUUID().slice(0, 8).toUpperCase();
    await db.prepare("INSERT INTO access_codes (code) VALUES (?)").bind(code).run();
    codici.push(code);
  }
  return codici;
}
