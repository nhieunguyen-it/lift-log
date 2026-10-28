# Profiles {#profiles}

Profiles are separate training contexts on one device, for example two people sharing a phone or one person keeping a cut and a bulk apart. Each profile has its own sessions, settings, programs, blocks, custom exercises and deload dismissals. Nothing is shared between them.

Your existing data is the **Default** profile, unchanged. You do not need to do anything to keep using it.

## Switch profile {#profiles-switch}

![The Profiles sheet at phone width: Partner marked Active, Default below, then New profile and Manage profiles](/guide/profiles-sheet.png)

1. Tap the round **avatar button** in the header (it shows the profile's initials).
2. In the **Profiles** sheet, tap the profile you want. The current one is marked **Active**.
3. The app reloads into that profile.

The active profile's name is shown on every screen, so you can always see where you are logging.

If you have a workout in progress, you are asked first. **Keep workout and switch** leaves the workout in its own profile, where it is waiting when you switch back. **Go back to workout** cancels the switch. A workout never moves to another profile.

The sheet lists a few profiles. Choose **Manage profiles** to see them all.

## Create, rename and import {#profiles-create}

![Settings Profiles section at phone width: each profile with Switch, Rename and Delete buttons, plus New profile and Import backup into a new profile](/guide/profiles-settings.png)

Open the avatar sheet and tap **New profile**, or go to Settings, then **Profiles**. Enter a **Profile name** and tap **Create profile**.

- Names use letters, digits, spaces, `_` and `-`, up to {{profiles.nameMaxLength}} characters, and must be unique.
- You can have at most {{profiles.max}} profiles. At the limit, creating another shows an error.
- A new profile starts empty and shows the welcome tour. The What's new notice is not shown again for it.

To rename, press **Rename** next to a profile in Settings, edit the **Profile name** and press **Save name**. Renaming the active profile reloads the app so every label agrees.

### Import a backup into a new profile {#profiles-import}

Press **Import backup into a new profile** in Settings, then choose a backup file (encrypted files ask for the passphrase first). The name defaults to the profile name stored in the backup; change it if you like, then press **Import and switch**. Your current data is not changed. See Backup, restore and encryption.

## Delete a profile {#profiles-delete}

1. Switch to another profile. The active profile cannot be deleted, and neither can the only profile.
2. In Settings under **Profiles**, press **Delete** next to the profile.
3. Type the profile's name to confirm and press **Delete profile**.

> [!NOTE]
> Deleting permanently removes that profile's workouts, programs and settings and cannot be undone. To keep a copy, switch to that profile and export a backup from Settings first.

## Profiles are not a lock {#profiles-privacy}

> [!NOTE]
> Profiles are **not a security boundary**. There is no PIN or password, so anyone who can open the app on this device and browser can switch to any profile. Each profile's data is stored unencrypted on the device.

To share data safely, export an encrypted backup with a passphrase. Each profile is backed up separately: export from inside the profile you want, and the file records that profile's name so it can be suggested again on import. Switching profiles does not back anything up.
