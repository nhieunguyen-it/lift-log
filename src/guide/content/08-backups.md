# Backup, restore and encryption {#backups}

Your data only lives on this device, so back it up.

## Export {#backups-export}

In Settings under **Your data**, press **Export JSON**. A file such as `lift-log-YYYY-MM-DD.json` downloads. It contains your workouts, custom exercises, programs and settings, but not the built-in exercise library.

A backup covers **one profile**: the one you are in. Its file records the profile name. To back up several profiles, switch to each and export.

## Encrypt with a passphrase {#backups-encrypt}

Type a **passphrase** (at least eight characters) and confirm it before exporting. The file is then encrypted on this device with a key derived from your passphrase ({{backup.pbkdf2Iterations}} PBKDF2 iterations) and is named `...-encrypted.json`. Leave both fields empty for a plain file.

> [!NOTE]
> **A lost passphrase cannot be recovered.** Nobody, including this app, can open the backup without it. Store it in a password manager.

## Restore {#backups-restore}

Press **Import JSON** and choose a file. For an encrypted file you are asked for the passphrase first; a wrong one shows an error and nothing changes. Then a confirmation shows how many workouts and sets the file holds. **Replace data** swaps your current data for the file. This cannot be undone, so export first if unsure.

Import accepts backup files from every version of the app (v1 to v5), and **Replace data** only replaces the current profile.

## Import into a new profile {#backups-import-profile}

To keep your current data and load a file alongside it, use Settings, **Profiles**, **Import backup into a new profile**. The new profile is named after the profile in the file by default. See Profiles.

## Moving to a new phone {#backups-move}

Export on the old device, send the file to the new one, open Lift Log there and import it.

> [!TIP]
> Back up before clearing browser data, reinstalling, or switching browsers.
