const puppeteer = require('puppeteer')
const auth = require('./auth.json') // [{username:"",password:""}]
const qs = require('querystring')

const subdomain = 'pathway'
const ou = '106509'
const quizes = ['492840']
const username = '[name=userName]'
const password = '[name=password]'
const bigButton = 'button[primary]'
const quizDetailsTable = 'table[role=presentation]'

var pici = 1


async function login(page) {
    await page.goto(`https://${subdomain}.brightspace.com/d2l/login?noredirect=true`)
    await page.type(username, auth[0].username)
    await page.type(password, auth[0].password)
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
    await login(page)
    await takeQuiz(page, '106509', '492840')
    // await browser.close()
}

async function takePicture(name){
    var fileName = `${pici.id}_${name}`
    await pici.page.screenshot({
        path:'shots/'+fileName+'.png',
        fullPage:true,
    })
}

async function takeQuiz(page, ou, quiz) {
    var date = new Date()
    pici = {page:page,ou:ou,quiz:quiz,date:date,user:auth[0].username,id:(Math.floor(date.getTime()/1000)).toString(36).slice(-4)}

    const quizURL = `https://${subdomain}.brightspace.com/d2l/lms/quizzing/user/quiz_summary.d2l?qi=${quiz}&ou=${ou}`
    await page.goto(quizURL)
    await takePicture('before')
    pici.beforeAttemptNumber = await numCompleted(page)
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

    // wait for the fram to actually load
    await frame.waitFor('h2.vui-heading-3')
    pici.afterAttemptNumber = await frame.evaluate(() => $('h2:contains("Attempt")').text().match(/\d+/)[0])

    await takePicture('after')

    await page.goto(`https://pathway.brightspace.com/d2l/lms/quizzing/user/quizzes_list.d2l?ou=${ou}`)
    
    pici.listAttemptNumber = await page.evaluate(quizId => $(`[onclick*="${quizId}"]`).closest('td').next().text().match(/\d+/)[0],quiz)

    await takePicture('list')

    console.log(pici)
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

function dumpFrameTree(frame, indent) {
    indent = indent || ''
    console.log(indent + frame.url());
    for (let child of frame.childFrames()){
        dumpFrameTree(child, indent + '  ');
    }
}

main()