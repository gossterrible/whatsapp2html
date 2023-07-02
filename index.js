#!/usr/bin/env node

import * as Eta from "eta"
import *  as fs from "fs-extra";

import { readFileSync, readdirSync, writeFile } from 'fs';

import Ffmpeg from "fluent-ffmpeg";
import chalk from "chalk";
import chalkAnimation from "chalk-animation";
import { createSpinner } from 'nanospinner'
import decompress from "decompress";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import ffprobe from "@ffprobe-installer/ffprobe";
import { fileURLToPath } from 'url';
import {getLinkPreview} from 'link-preview-js';
import inquirer from "inquirer";
import linkifyHtml from 'linkify-html';
import { parseString } from "whatsapp-chat-parser"
import path from "path";

const VERSION = '1.0.23';


Ffmpeg.setFfprobePath(ffprobe.path);
Ffmpeg.setFfmpegPath(ffmpeg.path);




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
let phone_number;
let other_user_name;
let profile_picture;
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
        `WhatsApp 2 HTML Converter  version:${VERSION}\n`
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
            decompress(backupFile, `./${outputDir}/output`).then(files => {
                spinner.success({ text: `Unzip completed` });
                resolve()
            }).catch(err => {
                spinner.fail({ text: `Unzip failed` });
                reject(err)
            })
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
        .then(async messages => {
            messages.shift() //remove first message (whatsapp notice)
            await addLinkPreview(messages)
            messages.map((message, i, arr) => {
                const prevMessage = arr[i - 1];
                const  date = new Date(message.date)
                let ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(date);
                let mo = new Intl.DateTimeFormat('en', { month: 'short' }).format(date);
                let da = new Intl.DateTimeFormat('en', { day: 'numeric' }).format(date);
                let formated_date = `${mo} ${da}, ${ye}`
                if (i === 0) {
                    processedMessages.push({
                        messageDate: formated_date,
                    })
                }
                if (prevMessage && new Date(prevMessage.date).toDateString() !== new Date(message.date).toDateString()) {
                    processedMessages.push({
                        messageDate: formated_date,
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
                        edited: message.message.includes("<This message was edited>") ? true : false,
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
async function addLinkPreview(messages) {
    return await Promise.all(messages.map(async (message, i, arr) => {
                try{
                    let link = linkifyHtml(message.message, options).match(/(https?:\/\/[^\s]+)/g)
                    if(link[0]){
                       
                        let clean_link = link[0].replace('"', '').toLocaleLowerCase().trim()
                        const link_preview = await getLinkPreview(clean_link)
                        if(link_preview){
                            message["link_preview"] = link_preview
                        }
                    }
                }catch(err){
                    //ignore
                }
                return message
            }))
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
async function askPhoneNumber() {
    const answers = await inquirer.prompt({
        name: 'phone_number',
        type: 'string',
        message: 'Phone number:',
        default() {
            return '';
        },

    });
    phone_number = answers.phone_number;
}
async function askOtherUserName() {
    const answers = await inquirer.prompt({
        name: 'other_user_name',
        type: 'string',
        message: 'Other user name (name to display in chat header):',
        default() {
            return 'John Doe';
        },
    });
    other_user_name = answers.other_user_name;
}
async function askForProfilePictureFilePath() {
    const answers = await inquirer.prompt({
        name: 'profile_picture',
        type: 'string',
        message: 'Profile picture file path example: profile.jpg (leave empty for default profile picture)',
        default() {
            return './profile.jpg';
        },
    });
    profile_picture = answers.profile_picture;
}

async function renderChat(messages, phone_number, other_user_name) {
    const phone_number_masked = maskPhoneNumber(phone_number);
    let chat = await Eta.renderFile("./layout", { messages: messages, phone_number: phone_number_masked,other_user_name:other_user_name })
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
                        spinner.error({ text: `${fileName} failed to convert to mp3` });
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
    await new Promise((resolve, reject) => {
        fs.copy(path.resolve(__dirname, 'js/zoom.js'), `./${outputDir}/js/zoom.js`, (err) => {
            if (err) {
                reject(err)
            }
            resolve()
        })
    })
    if (profile_picture) {
        await new Promise((resolve, reject) => {
            fs.copy(profile_picture, `./${outputDir}/img/profile.jpg`, (err) => {
                if (err) {
                    reject(err)
                }
                resolve()
            })
        })
    }
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

const maskPhoneNumber = (phone_number) => {
    if (typeof phone_number !== "string") {
        throw new Error("phone_number must be a string");
    }
    //convert string to array
    let phone_number_array = phone_number.split("");
    
    let seventh_digit_position = phone_number_array
        .map(function (value, index) {
            if (!isNaN(value) && value != " ") {
                return index;
            }
        }
        )
        .filter(function (value) {
            if (value != undefined) {
                return true;
            }
        }
        )[6];
    for (let i = seventh_digit_position; i < phone_number_array.length; i++) {
            if (!isNaN(phone_number_array[i]) && phone_number_array[i] != " ") {
                phone_number_array[i] = "X";
            }
    }
    return phone_number_array.join("");
}

await welcome();
await askBackup();
await askOutputDir();
await unzipBackup();
await convertOpusToMp3();
await readChatFile();
await getUsers();
await askActiveUser();
await askOtherUserName();
await askPhoneNumber();
await askForProfilePictureFilePath();
await processChat();
await renderChat(processedMessages, phone_number, other_user_name)
await copyStaticFiles();
await Done();