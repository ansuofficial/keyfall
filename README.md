# Keyfall

A free typing game for kids and grown-ups. Words fall from the sky: type each one before it reaches the ground.

Keyfall runs in any modern web browser. There's nothing to install, no account to make, and once you have the files you don't even need the internet. It works best with a real keyboard.

## Play it on your computer

1. At the top of this page, click the green **Code** button, then **Download ZIP**.
2. Unzip the file you downloaded. You get a folder called `keyfall-main`.
3. Open that folder and double-click `index.html`. The game opens in your web browser.

## How to play

- Press **Start**, or the Enter key, to begin.
- Type a falling word to fire at it. The letters you have typed turn blue.
- Clear every word in a wave to reach the next one. Each wave has more words, and they fall faster.
- If a word reaches the ground, you lose a life. The blue ring around the cannon has three parts, one for each life. Lose all three and the game is over.
- Press **Esc** to pause, and **Esc** again to keep going.
- On the start screen, click the word set (Common words, Code words or Home row) or the pace (Calm, Normal or Fast) to change it. Your best score for each word set is saved in your browser.
- Sound is on at first. Click **Sound on** on the start screen to turn it off, and click it again to turn it back on. You can also press **Esc** during a game and use the same button on the Pause card. Your choice is saved in your browser.

## Change the words

The word lists are near the top of `js/game.js`. Open that file in a plain text editor, such as Notepad on Windows or VS Code on any computer. You will see this:

```js
const WORDS = {
  common: uniq("time year people way day ..."),
  code: uniq("const let var function return ..."),
  home: uniq("as ad add all ask ...")
};
```

Each list is one line of words with a space between them. Add or remove words, save the file, then refresh the game in your browser.

- Use only lowercase letters from a to z. The game can't type capital letters, numbers, spaces or punctuation inside a word.
- Short words come first. Longer words start to fall in later waves.

To add a word set of your own, add a list to `WORDS` and a matching line to `SETS` just below it. Mind the commas between lines:

```js
const WORDS = {
  common: uniq("time year people way day ..."),
  code: uniq("const let var function return ..."),
  home: uniq("as ad add all ask ..."),
  animals: uniq("cat dog frog duck fish hen")
};
const SETS = [
  { id: "common", label: "Common words" },
  { id: "code", label: "Code words" },
  { id: "home", label: "Home row" },
  { id: "animals", label: "Animals" }
];
```

## Put it online for free

Keyfall is a few plain files with no build step, so any free static web host can run it. With GitHub Pages:

1. Sign in to GitHub and click **Fork** at the top of this page to make your own copy.
2. In your copy, open **Settings**, then **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and click **Save**.
4. After a minute or two, your game is live at `https://<your-username>.github.io/keyfall/`.

## What's inside

```
index.html       the page
css/styles.css   colors, fonts and layout
js/game.js       the game, including the word lists
```

## License

Keyfall is free and open source under the [MIT License](LICENSE). Anyone, schools included, can use it, change it and share it, as long as they keep the license file with it.

Made by Ansu Badjie.
