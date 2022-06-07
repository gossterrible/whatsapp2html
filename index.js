#!/usr/bin/env node

import chalk from "chalk";
import inquirer from "inquirer";
import chalkAnimation from "chalk-animation";
import { Extract } from "unzipper";

import Ffmpeg from "fluent-ffmpeg";
import ffprobe from "@ffprobe-installer/ffprobe";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
Ffmpeg.setFfprobePath(ffprobe.path);
Ffmpeg.setFfmpegPath(ffmpeg.path);



import { createReadStream, readFileSync, writeFile, readdirSync } from 'fs';
import *  as fs from "fs-extra";
import { fileURLToPath } from 'url';
import { parseString } from "whatsapp-chat-parser"
import * as Eta from "eta"
import path from "path";
import linkifyHtml from 'linkify-html';
import { createSpinner } from 'nanospinner'

const options = { defaultProtocol: 'http', target: '_blank' };
const intlOptions = {
    hour: 'numeric',
    minute: 'numeric',
};
const dateOptions = { month: '2-digit', day: '2-digit', year: 'numeric' }
// Set Eta's configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
Eta.configure({
    views: path.join(__dirname, "views")
})
const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));
let backupFile;
let chatContent;
let activeUser;
let users = [];
let processedMessages = [];
let outputDir;
const cssDir = path.join(process.cwd(), "css")
const jsDir = path.join(process.cwd(), "js")
const cssFile = path.join(cssDir, "styles.css")
const cssPlayer = path.join(cssDir, "player.css")
const jsFile = path.join(jsDir, "player.js")

const processSpinner = createSpinner('Processing messages....');
const generatingChatSpinner = createSpinner('Generating chat....');
async function welcome() {
    const rainbowTitle = chalkAnimation.rainbow(
        'WhatsApp 2 HTML Converter \n'
    );

    await sleep();
    rainbowTitle.stop();

    console.log(`
    ${chalk.bgBlue('HOW IT WORKS ')} 
    1. Download your whatsapp backup file in .zip format.
    2. Provide the path to your whatsapp backup file.
    3. Provide the path to your output directory.
    4. Choose the active user.
    5. Wait for the conversion to complete.
  `);
}
async function askBackup() {
    const answers = await inquirer.prompt({
        name: 'backup_path',
        type: 'string',
        message: 'Path to your backup file:',
        default() {
            return './chat.zip';
        },
    });

    backupFile = answers.backup_path;
}
async function askOutputDir() {
    const answers = await inquirer.prompt({
        name: 'output',
        type: 'string',
        message: 'Path to your output directory:',
        default() {
            return 'whatsappChat';
        },
    });

    outputDir = answers.output;
}
async function unzipBackup() {
    const spinner = createSpinner('Unzipping backup....').start();

    await new Promise((resolve, reject) => {
        createReadStream(backupFile).pipe(Extract({ path: `./${outputDir}/output` }).on('close', () => {
            spinner.success({ text: `Unzip completed` });
            resolve()
        }))
    })

}
async function readChatFile() {
    processSpinner.start()
    chatContent = readFileSync(`./${outputDir}/output/_chat.txt`, 'utf8');
}
async function getUsers() {
    await parseString(chatContent, { parseAttachments: true })
        .then(messages => {
            messages.shift() //remove first message (whatsapp notice)
            messages.map(message => {

                users.push(message.author)
            })
            users = [...new Set(users)];
            processSpinner.stop()
        })
        .catch(err => {
            console.log(err)
            console.log("Sorry an error occurred  when parsing the whatsapp file")
        });

}
async function processChat() {
    processSpinner.success({ text: `Chat successfully processed` });
    processSpinner.stop();
    generatingChatSpinner.start()
    await parseString(chatContent, { parseAttachments: true })
        .then(messages => {
            messages.shift() //remove first message (whatsapp notice)
            messages.map((message, i, arr) => {
                const prevMessage = arr[i - 1];
                if (i === 0) {
                    processedMessages.push({
                        messageDate: new Date(message.date).toLocaleString('en-US', dateOptions),
                    })
                }
                if (prevMessage && new Date(prevMessage.date).toDateString() !== new Date(message.date).toDateString()) {
                    processedMessages.push({
                        messageDate: new Date(message.date).toLocaleString('en-US', dateOptions),
                    })
                }
                if (message.attachment) {
                    if (getMimeType(message?.attachment?.fileName) == "audio/ogg") {
                        message.attachment.fileName = message.attachment.fileName.replace(".opus", ".mp3")
                    }
                    processedMessages.push({
                        ...message,
                        date: new Intl.DateTimeFormat('en-US', intlOptions).format(message.date),
                        fileMimeType: getMimeType(message?.attachment?.fileName),
                        activeUser: message.author == activeUser ? true : false,
                    })
                } else {
                    processedMessages.push({
                        ...message,
                        message: linkifyHtml(message.message, options),
                        fileMimeType: '',
                        date: new Intl.DateTimeFormat('en-US', intlOptions).format(message.date),
                        activeUser: message.author == activeUser ? true : false,
                    })

                }

            })

        })
        .catch(err => {
            console.log(err)
            console.log("Sorry an error occurred  when parsing the whatsapp file")
        });

}
async function askActiveUser() {
    const answers = await inquirer.prompt({
        name: 'active_user',
        type: 'list',
        message: 'Active user:',
        choices: users,
    });

    activeUser = answers.active_user;
}
async function renderChat(messages) {
    let chat = await Eta.renderFile("./layout", { messages: messages })
    writeFile(`./${outputDir}/index.html`, chat, err => {
        if (err) {
            return console.error(`Failed to generate file: ${err.message}.`);
        }
    });
}
async function convertOpusToMp3() {
    const spinner = createSpinner('Converting audio files....').start();
    const files = readdirSync(`./${outputDir}/output`)
    for (const file of files) {
        if (file.endsWith('.opus')) {
            const fileName = file.split('.')[0]
            const filePath = `./${outputDir}/output/${file}`
            const outputPath = `./${outputDir}/output/${fileName}.mp3`
            await new Promise((resolve, reject) => {
                Ffmpeg(filePath)
                    .toFormat('mp3')
                    .on('end', () => {
                        spinner.success({ text: `${fileName} converted to mp3` });
                        resolve()
                    })
                    .on('error', (err) => {
                        spinner.fail({ text: `${fileName} failed to convert to mp3` });
                        reject(err)
                    })
                    .save(outputPath)
            })
        }
    }
    spinner.stop();
}
async function copyStaticFiles() {
    await new Promise((resolve, reject) => {
        fs.copy(path.resolve(__dirname, 'css/styles.css'), `./${outputDir}/css/styles.css`, (err) => {
            if (err) {
                reject(err)
            }
            resolve()
        })
    })
    await new Promise((resolve, reject) => {
        fs.copy(path.resolve(__dirname, 'css/player.css'), `./${outputDir}/css/player.css`, (err) => {
            if (err) {
                reject(err)
            }
            resolve()
        })
    })
    await new Promise((resolve, reject) => {
        fs.copy(path.resolve(__dirname, 'js/player.js'), `./${outputDir}/js/player.js`, (err) => {
            if (err) {
                reject(err)
            }
            resolve()
        })
    })
    generatingChatSpinner.success({ text: `Chat generated successfully` });
}
async function Done() {
    console.log(`${chalk.bgBlue('HTML Chat generated successfully!')}
    `)
}


//Utils
const getMimeType = fileName => {
    if (/\.jpe?g$/.test(fileName)) return 'image/jpeg';
    if (fileName.endsWith('.png')) return 'image/png';
    if (fileName.endsWith('.gif')) return 'image/gif';
    if (fileName.endsWith('.webp')) return 'image/webp';
    if (fileName.endsWith('.svg')) return 'image/svg+xml';

    if (fileName.endsWith('.mp4')) return 'video/mp4';
    if (fileName.endsWith('.webm')) return 'video/webm';

    if (fileName.endsWith('.mp3')) return 'audio/mpeg';
    if (fileName.endsWith('.m4a')) return 'audio/mp4';
    if (fileName.endsWith('.wav')) return 'audio/wav';
    if (fileName.endsWith('.opus')) return 'audio/ogg';

    return null;
};

await welcome();
await askBackup();
await askOutputDir();
await unzipBackup();
await convertOpusToMp3();
await readChatFile();
await getUsers();
await askActiveUser();
await processChat();
await renderChat(processedMessages)
await copyStaticFiles();
await Done();