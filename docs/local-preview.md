# Local preview

You never need a preview: every commit is checked before anything is published. But seeing a change
before you commit it is handy, especially for longer edits. There are three ways.

## In the browser: Codespaces

1. In your repository, click **Code → Codespaces → Create codespace on main**.
2. Wait a minute or two while it installs. A **Site preview** tab opens beside the editor, and
   `site.yaml` opens for editing.
3. Edit any file. The preview reloads when you save (Ctrl+S or Cmd+S), and mistakes show as a message
   on the page and in the terminal.
4. To publish, commit your changes from the *Source Control* panel and click **Sync changes**.

If the preview tab doesn't open, open the *Ports* panel and click the globe icon next to port 4321.
In `.yaml` files, the editor suggests field names and underlines mistakes as you type.

Codespaces is free for a number of hours each month on personal accounts. Stop the codespace when
you're done (*Code → Codespaces → … → Stop codespace*); GitHub also stops it after 30 minutes idle.

## On your computer

You need [Node.js](https://nodejs.org/) 22.12 or later, and git.

```sh
git clone https://github.com/<you>/<repository>.git
cd <repository>
npm install
npm run dev
```

Open http://localhost:4321. The page reloads as you edit files. Stop it with Ctrl+C.

Other commands:

| Command | What it does |
|---|---|
| `npm run check` | Checks `site.yaml` and `content/` and lists every problem with its file and line. The deploy runs the same check. |
| `npm run build` | Builds the site into `dist/`, as the deploy does. |
| `npm run preview` | Serves the built `dist/` folder. |

Then commit and push as usual. `dist/`, `node_modules/` and `.astro/` are ignored by git.

The site's address in a local preview is always `http://localhost:4321/`, even for a project site
that is published under `/<repository>/`. Links work either way.

## With a pull request

To review a larger change on GitHub before it goes live, choose **Create a new branch for this commit
and start a pull request** when you commit. The pull request runs the checks and a full build, so you
see any problem, but publishes nothing. Merge it to publish.
