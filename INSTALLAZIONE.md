# Installare Alexandria

Alexandria è un'app per archiviare, organizzare, leggere e ritrovare articoli
scientifici in PDF. Funziona su **Windows 10/11** e **macOS 11 o successivi**,
senza account e senza internet (la connessione serve solo per recuperare
automaticamente i dati degli articoli dal DOI).

L'app non è firmata con un certificato a pagamento: al primo avvio il sistema
mostra un avviso. È normale, e si supera una volta sola seguendo i passi qui sotto.

---

## Windows

1. Scarica il file **`Alexandria_x.y.z_x64-setup.exe`**.
2. Fai doppio clic sul file.
3. Se compare la finestra blu **"Windows ha protetto il PC"**:
   - clicca **Ulteriori informazioni**;
   - poi **Esegui comunque**.
4. Segui l'installazione (non servono permessi di amministratore).
5. Trovi Alexandria nel menu Start.

## Mac

1. Scarica il file **`Alexandria_x.y.z_universal.dmg`** (va bene sia per i Mac
   con processore Apple sia per quelli Intel).
2. Apri il file `.dmg` e trascina **Alexandria** nella cartella **Applicazioni**.
3. Apri Alexandria dalla cartella Applicazioni. Comparirà un avviso che l'app
   "non può essere aperta": clicca **Fine** (o **OK**).
4. Apri **Impostazioni di Sistema → Privacy e sicurezza**, scorri in basso fino
   al messaggio su Alexandria e clicca **Apri comunque**. Conferma con la
   password del Mac.
5. Da quel momento Alexandria si apre normalmente.

Se il Mac dice che l'app **"è danneggiata"**, apri l'app **Terminale**, incolla
questo comando e premi Invio, poi riprova ad aprirla:

```bash
xattr -cr /Applications/Alexandria.app
```

---

## Primo avvio

Alexandria chiede dove conservare la **libreria**: la cartella che conterrà i
PDF e il database. Va bene la proposta predefinita (`Documenti/Alexandria`).

**Per usare la stessa libreria su più computer** (per esempio PC e Mac) scegli
una cartella sincronizzata da un servizio cloud personale: iCloud Drive,
Dropbox, Google Drive o OneDrive. Una sola regola: **non tenere Alexandria
aperta su due computer nello stesso momento**. Se succede, l'app avvisa.

## I tuoi dati

- I PDF sono file normali nella cartella `pdf` della libreria, con nomi
  leggibili (es. `2015 - LeCun - Deep learning.pdf`).
- Ogni giorno Alexandria salva una copia del database nella cartella `backup`
  (si tengono le ultime 7). Per ripristinarne una: chiudi Alexandria, copia il
  file di backup al posto di `alexandria.db` e rinominalo `alexandria.db`.
- Per spostare la libreria: chiudi Alexandria, sposta l'intera cartella, poi
  riapri Alexandria e indicala dal menu in basso a sinistra
  ("Apri o crea un'altra libreria…").

## Aggiornare

Scarica e installa la nuova versione sopra quella vecchia: la libreria e i
dati restano dove sono.
