const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://dart-bot-app:xhfbGnfII6WhJKEA@pickware.biz4mzw.mongodb.net/dart-stats";
const client = new MongoClient(uri);

function asDate(d){ return new Date(d); }

async function run() {
  try {
    await client.connect();
    const db = client.db('dart-stats');
    const players = db.collection('players');
    const games = db.collection('games');

    const allPlayers = await players.find({}).toArray();
    let totalLinked = 0;
    let totalAdjustedDates = 0;

    for (const p of allPlayers) {
      if (!Array.isArray(p.eloHistory)) continue;

      for (const entry of p.eloHistory) {
        if (!entry) continue;
        // Skip initial 1970 entries
        const ed = new Date(entry.date);
        if (ed.getTime() === 0) continue;
        // Already linked
        if (entry.gameId) continue;

        const result = entry.result; // 'win' | 'loss' | undefined
        const opponent = entry.opponent; // string | undefined
        const t = new Date(entry.date);
        const windowMs = 3 * 60 * 60 * 1000; // 3h Toleranz

        let query = null;
        if (result && opponent) {
          if (result === 'win') {
            query = {
              winner: p.name,
              loser: opponent,
              date: { $gte: new Date(t.getTime() - windowMs), $lte: new Date(t.getTime() + windowMs) }
            };
          } else if (result === 'loss') {
            query = {
              winner: opponent,
              loser: p.name,
              date: { $gte: new Date(t.getTime() - windowMs), $lte: new Date(t.getTime() + windowMs) }
            };
          }
        }

        let matchedGame = null;
        if (query) {
          // If multiple, pick the closest by date
          const list = await games.find(query).toArray();
          if (list.length > 0) {
            list.sort((a,b)=> Math.abs(new Date(a.date) - t) - Math.abs(new Date(b.date) - t));
            matchedGame = list[0];
          }
        }

        // Fallback: any game with this player near the time
        if (!matchedGame) {
          const list = await games.find({
            date: { $gte: new Date(t.getTime() - windowMs), $lte: new Date(t.getTime() + windowMs) },
            $or: [{ winner: p.name }, { loser: p.name }]
          }).toArray();
          if (list.length > 0) {
            list.sort((a,b)=> Math.abs(new Date(a.date) - t) - Math.abs(new Date(b.date) - t));
            matchedGame = list[0];
          }
        }

        if (matchedGame) {
          // Write gameId to this entry via arrayFilters
          const res = await players.updateOne(
            { _id: p._id, "eloHistory._id": entry._id },
            {
              $set: {
                "eloHistory.$.gameId": matchedGame._id,
              }
            }
          );
          if (res.modifiedCount > 0) totalLinked++;

          // Align date if drift > 1 minute
          const drift = Math.abs(new Date(matchedGame.date).getTime() - t.getTime());
          if (drift > 60*1000) {
            const res2 = await players.updateOne(
              { _id: p._id, "eloHistory._id": entry._id },
              { $set: { "eloHistory.$.date": new Date(matchedGame.date) } }
            );
            if (res2.modifiedCount > 0) totalAdjustedDates++;
          }
        }
      }
    }

    console.log(`Verknüpfte Einträge (gameId gesetzt): ${totalLinked}`);
    console.log(`Angepasste Zeitstempel in eloHistory: ${totalAdjustedDates}`);

  } catch (e) {
    console.error('Fehler beim Backfill:', e);
  } finally {
    await client.close();
  }
}

run(); 