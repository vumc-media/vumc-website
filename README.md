# VUMC Member Portal Landing Page

This folder contains a complete standalone landing page for:

`https://www.versaillesumc.org/members/`

## Repository installation

1. Open the GitHub repository that publishes `versaillesumc.org`.
2. In the repository root, create a folder named:

   `members`

3. Upload `index.html` into the new `members` folder.
4. Inside `members`, create another folder named:

   `assets`

5. Upload the final hero image as:

   `member-portal-hero.webp`

   Recommended size: **1800 × 1000 pixels or larger**, landscape orientation.

6. Commit the changes to the publishing branch, normally `main`.
7. After GitHub Pages rebuilds, visit:

   `https://www.versaillesumc.org/members/`

## Suggested media

### Hero image

Use a genuine VUMC photo showing people rather than an empty building.

Best choices:

- Members talking in the atrium
- A Sunday worship congregation photo
- Greeters welcoming people
- A multi-generational church gathering

The photo should have its most important people or activity toward the right half. The page places the heading on the left.

### Optional Church Center image

The phone illustration is already built with HTML and CSS. No app screenshot is required.

An optional image can be added at:

`members/assets/church-center-app.webp`

If omitted, the section still displays correctly.

## Add the Member Portal to the site navigation

Add this link to the desktop and mobile navigation menus:

```html
<a href="/members/">Member Portal</a>
```

A button version can use the existing navigation button class from the main website.

## Links currently included

- Main Church Center: `https://versaillesumc.churchcenter.com`
- Giving: `https://versaillesumc.churchcenter.com/giving`
- Groups: `https://versaillesumc.churchcenter.com/groups`
- Directory: `https://versaillesumc.churchcenter.com/directory`
- Church Bulletin: `https://versaillesumc.churchcenter.com/pages/church-bulletin`
- Calendar: `https://versaillesumc.churchcenter.com/calendar`
- Announcements: bulletin announcement section
- Sermon Notes: `https://versaillesumc.churchcenter.com/pages/sermon-notes`
- Contact Us: `https://versaillesumc.churchcenter.com/pages/contact-us`

## Important check after publishing

Open every card once. Church Center custom-page addresses can be renamed in Planning Center Publishing. If a custom page has a different address, replace only that card's `href` value in `index.html`.

## Recommended next adjustment

Once this page is online, compare its header with the current VUMC homepage. The portal header is self-contained, but its navigation can be replaced with the exact shared website header later so every page remains identical.
