// /* eslint no-unused-vars:0 no-console:0 */ 
var $

// Dependencies
const puppeteer = require('puppeteer')
const auth = require('./auth.json') // [{username:"",password:""}]
const Path = require('path')
const fs = require('fs')
const moment = require('moment')

// Temporary Globals
const subdomain = 'pathway'
const ous = ['106509']
const quizzes = ['492840']
const screenshotFolder = Path.join(__dirname,'shots')
const testDataFile = Path.join(__dirname,'data.json')

// Selectors
const username = '[name=userName]'
const password = '[name=password]'
const bigButton = 'button[primary]'
const quizDetailsTable = 'table[role=presentation]'
const AttemptHeader = 'h2.vui-heading-3'

function createTestData (ou,quizId,userId){
    var date = new Date()
    return {
        ou: ou,
        quizId:quizId,
        date:date,
        userId:userId,
        id: Math.floor(date.getTime()/1000).toString(36).slice(-4),
        pics: []
    }
}

async function login(page,userId) {
    await page.deleteCookie(...await page.cookies())
    await page.goto(`https://${subdomain}.brightspace.com/d2l/login?noredirect=true`)
    await page.type(username, auth[userId].username)
    await page.type(password, auth[userId].password)
    await Promise.all([
        page.waitForNavigation(),
        page.click(bigButton)
    ])
}

async function main() {
    const browser = await puppeteer.launch({
        headless: false
    })
    const page = await browser.newPage()
    await page.setViewport({width:1000,height:1000})
    
    // For each user
    for(var userId = 0; userId < auth.length; userId++){
        await login(page,userId)
        // For each course
        for(var oui = 0; oui < ous.length; oui++){
            // For each quiz
            for(var quizi = 0; quizi < quizzes.length; quizi++){
                // Setup test
                var testData = createTestData(ous[oui],quizzes[quizi],userId)
                // DO IT!!
                await takeQuiz(page,testData)
                // Write out results
                appendTestData(testData)
            }
        }
    }

    await browser.close()
}


async function takeQuiz(page, testData) {
    async function takePicture(name){
        var filename = `${testData.id}_${moment(testData.date).format('YYYY-D-M--h;mm;ssa')}_${testData.ou}_${testData.quizId}_${testData.userId}_${name}.png`
        var path = Path.join(screenshotFolder,filename)
        testData.pics.push(path)
        await page.screenshot({
            path:path,
            fullPage:true,
        })
    }
    // Going to the quiz
    const quizURL = `https://${subdomain}.brightspace.com/d2l/lms/quizzing/user/quiz_summary.d2l?qi=${testData.quizId}&ou=${testData.ou}`
    await page.goto(quizURL)
    // Record what it looks like
    await takePicture('before')
    testData.beforeAttemptNumber = await numCompleted(page)
    
    // Start the quiz
    await Promise.all([
        page.waitForNavigation(),
        page.click(bigButton)
    ])
    await takePicture('started')
    var frame = await page.frames().find(f => f.url().includes('quiz_attempt_page'))
    
    // Throw some random answers in there just for fun
    await frame.$$eval('fieldset',fieldsets => {
        Array.prototype.pick = function(){return this[Math.floor(Math.random()*this.length)]}
        $(fieldsets).get().map(f => $(f)).map($f => {
            $($f.find('tr.d2l-rowshadeonhover').get().pick()).click()
            $f.find('textarea').val('Haha here is my answer')
        })
    })
    await takePicture('answered')
    
    // Click submit
    frame = (await Promise.all([
        waitForFrame(page,'quiz_confirm_submit'),
        frame.$eval(bigButton, b => $(b).next().click(),bigButton)
    ]))[0]
    // we waited for the frame to change, now we just need to wait for the button to pop up
    await frame.waitFor(bigButton)
    await takePicture('confirm')
    
    // And click submit again because it is d2l
    frame = (await Promise.all([
        waitForFrame(page,'quiz_submissions_attempt'),
        frame.$eval(bigButton, b => b.click(),bigButton)
    ]))[0]

    // wait for the frame to actually load
    await frame.waitFor(AttemptHeader)
    testData.afterAttemptNumber = await frame.evaluate(() => $('h2:contains("Attempt")').text().match(/\d+/)[0])
    await takePicture('after')

    // Go to the quizzes list to see if the attempt showed up
    await page.goto(`https://pathway.brightspace.com/d2l/lms/quizzing/user/quizzes_list.d2l?ou=${testData.ou}`)
    testData.listAttemptNumber = await page.evaluate(quizId => $(`[onclick*="${quizId}"]`).closest('td').next().text().match(/\d+/)[0],testData.quizId)
    await takePicture('list')
}

async function waitForFrame(page,frameName){
    return new Promise(res => {
        page.on('framenavigated',async () => {
            var frame = await page.frames().find(f => f.url().includes(frameName))
            if(frame){
                res(frame)
            }
        });
    })
}

async function numCompleted(page) {
    var match = await page.$eval(quizDetailsTable, t => $(t).text().match(/Completed - (\d+)/))
    if (match) {
        return match[1]
    } else {
        throw 'Couldn\'t find number completed'
    }
}

function appendTestData(testData){
    var data = []
    if(fs.existsSync(testDataFile)){
        var stringed = fs.readFileSync(testDataFile,'utf-8')
        data = JSON.parse(stringed)
    }
    data.push(testData)
    fs.writeFileSync(testDataFile,JSON.stringify(data))
}
// function dumpFrameTree(frame, indent) {
//     indent = indent || ''
//     console.log(indent + frame.url());
//     for (let child of frame.childFrames()){
//         dumpFrameTree(child, indent + '  ');
//     }
// }

main()