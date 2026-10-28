# Getting started {#getting-started}

Lift Log is a private workout log. You log sets, and it turns them into weekly muscle volume, next-session targets and gentle suggestions. It needs no account and no internet connection.

## Install it on your phone {#getting-started-install}

Lift Log is a PWA (progressive web app), so you can add it to your home screen and open it like a normal app.

- **Android / Chrome:** open the menu and choose _Install app_ (or _Add to Home screen_).
- **iPhone / iPad:** open the site in **Safari**, tap the Share button, then _Add to Home Screen_.

> [!NOTE]
> On iOS, only Safari offers _Add to Home Screen_ for web apps. See the FAQ if the installed app seems to have lost your data.

## Works offline {#getting-started-offline}

After the first load the app and all exercise photos are saved on your device by a service worker. You can log a workout in a gym with no signal. There is no sync, because there is no server.

## Where your data lives {#getting-started-data}

Everything is stored in your browser's database (IndexedDB) on **this device only**. Nothing is uploaded. That also means:

- Another phone or browser starts empty. Move data with a backup (see Backup, restore and encryption).
- Clearing site data for the app deletes your log. Export a backup now and then.

## Profiles {#getting-started-profiles}

Everything you have is in the **Default** profile. If more than one person uses the device, or you want to keep two training contexts apart, tap the avatar button in the header to switch or add profiles. See Profiles, starting with how to create one (`#profiles-create`).

## Units and week start {#getting-started-units}

On first launch a short tour asks for your weight unit (kg or lbs) and which day your week starts on. You can skip it, and change both later in Settings. Weights are stored in kg and converted for display, so switching units never changes your history.

## The five tabs {#getting-started-tabs}

| Tab       | What it is for                                |
| --------- | --------------------------------------------- |
| Workout   | Log the current session                       |
| History   | Past workouts                                 |
| Analyze   | Weekly volume per muscle                      |
| Exercises | Browse and add exercises                      |
| Settings  | Units, targets, equipment, backup, this guide |

Look for the **?** button next to a page title: it opens the matching part of this guide. Programs live at **Manage programs** on the Workout tab.

## Using this guide {#getting-started-guide}

The Guide (Settings, then _Guide_) is searchable and works offline. From there you can also replay the welcome tour or see what is new.
