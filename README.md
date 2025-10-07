# Midi Demo Page Template

Plays and visualizes midi files on github pages. Only single-instrument midi files are supported.

<img width="1905" height="941" alt="image" src="https://github.com/user-attachments/assets/250da5eb-84f4-4909-94fc-ca570c3e5d8f" />


## Usage

1. Put your midi files in the `resource` folder with the following structure:

```
resource/

    settings.json

    basic_section_1/
        1.mid
        2.mid
        ...

    grouped_section_1/
        model_A/
            1.mid
            2.mid
            ...
        model_B/
            1.mid
            2.mid
            ...
    ...
```

2. Edit the `settings.json` file to customize the page.

3. Push your changes to github.

4. The page will be deployed to `gh-pages` branch by github actions.

5. Publish the page with github pages.

![Image](https://i.imgur.com/OrlRIt1.png)

## Build locally

```bash
npm install
npm run build
```
## Develop locally

```bash
npm install
npm run dev
```
