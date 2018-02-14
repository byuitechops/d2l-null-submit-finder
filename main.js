// /* eslint no-unused-vars:0 no-console:0 */ 
var $

// Dependencies
const puppeteer = require('puppeteer')
const auth = require('./auth.json') // [{username:"",password:""}]
const Path = require('path')
const fs = require('fs')
const moment = require('moment')
const createhtml = require('./createhtml')

const courses = [{
    ou:'106509',
    // Only the first 4 of these quizzes don't have deadlines
    quizzes: ['492840', '492841', '492842', '492843', '492844', '492845', '492846', '492871', '492847', '492848', '492849', '492850', '492851', '492852', '492853', '492854', '492855', '492856', '492857', '492858', '492859', '492860', '492861', '492862', '492863', '492864', '492865', '492866', '492867', '492868', '492869', '492870', '492872', '492873', '492828', '492829', '492830', '492831', '492832', '492833', '492834', '492835', '492836', '492837', '492838', '492839']
},{
    ou:'106526',
    quizzes: ['492875','492876','492880','492883','492885','492887','492890','492892','492894','492899','492903','492906','492908','492909','492910','492911','492912','492913','492914','492915','492916','492971','492978','492987','492917','492918','492919','492920','492921','492922','492923','492924','492925','492926','492927','492928','492929','492930','492931','492932','492933','492934','492935','492936','492937','492938','492939','492940','492941','492942','492943','492944','492945','492946','492947','492948','492949','492950','492951','492952','492953','492954','492955','492956','492957','492958','492959','492960','492961','492962','492963','492964','492965','492966','492967','492968','492969','492970','492972','492979','492980','492981','492982','492983','492984','492985','492986','492988','492989','492877','492878','492879','492881','492882','492884','492886','492888','492889','492891','492893','492895','492896','492897','492898','492900','492901','492902','492904','492905','492907','492973','492974','492975','492976','492977']
}]

// Temporary Globals
const subdomain = 'pathway'
const screenshotFolder = Path.join(__dirname,'shots')
const testDataFile = Path.join(__dirname,'data.json')
const HowManyStudentsToNotClearAttempts = 2
const teacherCookies = [{
    name:'d2lSecureSessionVal',
    value:'imjAZj18TjuGNJQPPBPsZaDQF',
    domain:'pathway.brightspace.com'
},{
    name:'d2lSessionVal',
    value:'D5jFnUvZuok7mBA5zvJxUxaHY',
    domain:'pathway.brightspace.com'
}]

// Selectors
const username = '[name=userName]'
const password = '[name=password]'
const bigButton = 'button[primary]'
const quizDetailsTable = 'table[role=presentation]'
const AttemptHeader = 'h2.vui-heading-3'
const StudentAttemptsCheckbox = 'input[name="gridAttempts_grpCb"]'
const resetButton = 'a[title="Reset"]'
const confirmDialogButton = '.d2l-dialog-buttons button[primary]'


async function main(){
    const browser = await puppeteer.launch({
        headless: false
    })
    const page = await browser.newPage()
    await page.setCookie(...teacherCookies)

    for(var i = 0; i < courses.length; i++){
        for(var k = 0; k < courses[i].quizzes.length; k++){
            var url = `https://pathway.brightspace.com/d2l/lms/quizzing/admin/modify/quiz_newedit_restrictions.d2l?d2l_isfromtab=1&qi=${courses[i].quizzes[k]}&ou=${courses[i].ou}`
            await page.goto(url)
            if(await page.evaluate(() => !$('label:contains("End Date")').parent().parent().find('[disabled]').length)){
                await page.evaluate(() => $('label:contains("End Date")').prev().click())
            }
            if(await page.evaluate(() => !$('label:contains("Start Date")').parent().parent().find('[disabled]').length)){
                await page.evaluate(() => $('label:contains("Start Date")').prev().click())
            }
            await Promise.all([
                page.waitForNavigation(),
                page.click('.d2l-floating-buttons button:nth-child(2)')
            ])
        }
    }
    await browser.close()
}

async function main2() {
    const browser = await puppeteer.launch({
        headless: true
    })
    const page = await browser.newPage()
    await page.setViewport({width:1000,height:1000})
    
    // For each user
    for(var userId = 0; userId < auth.length; userId++){
        await login(page,userId)
        // For each course
        for(var ci = 0; ci < courses.length; ci++){
            // For each quiz
            for(var quizi = 0; quizi < courses[ci].quizzes.length; quizi++){
                // Setup test
                var testData = createTestData(courses[ci].ou,courses[ci].quizzes[quizi],userId)
                // DO IT!!
                await takeQuiz(page,testData)
                // Clear some student's attempts
                await removeAttempts(page,testData)
                // Write out results
                appendTestData(testData)
                // Let the console know we are still running
                console.log(Object.values(testData).filter(n => typeof n != 'object').reduce((str,n) => str + String(n).padEnd(10),''))
            }
        }
    }
    await browser.close()
    
    createhtml()
}

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

async function takeQuiz(page, testData) {
    async function takePicture(name){
        // Create the folder if it dosen't exist
        if(!fs.existsSync(screenshotFolder)){
            fs.mkdirSync(screenshotFolder)
        }
        var filename = `${testData.id}_${moment(testData.date).format('YYYY-D-M--H;mm;ss')}_${testData.ou}_${testData.quizId}_${testData.userId}_${name}.png`
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
    await page.goto(`https://${subdomain}.brightspace.com/d2l/lms/quizzing/user/quizzes_list.d2l?ou=${testData.ou}`)
    testData.listAttemptNumber = await page.evaluate(quizId => $(`[onclick*="${quizId}"]`).closest('td').next().text().match(/\d+/)[0],testData.quizId)
    await takePicture('list')

    // Clear our handlers
    await page.removeAllListeners()
}

async function waitForFrame(page,frameName){
    return new Promise(res => {
        page.on('framenavigated',async () => {
            var frame = await page.frames().find(f => f.url().includes(frameName))
            if(frame){
                res(frame)
            }
            // Remove the listener cause we are done with it
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

async function removeAttempts(page,testData){
    // Need higher permissions so swap out my cookies
    var studentCookies = await page.cookies()
    await page.deleteCookie(...studentCookies)
    await page.setCookie(...teacherCookies)

    // Select the students to clear
    await page.goto(`https://${subdomain}.brightspace.com/d2l/lms/quizzing/admin/mark/quiz_mark_users.d2l?qi=${testData.quizId}&ou=${testData.ou}`)

    const numOfStudents = await page.$$eval(StudentAttemptsCheckbox, checkboxes => checkboxes.length)
    
    await page.$$eval(StudentAttemptsCheckbox, (checkboxes,limit) => [...checkboxes].slice(limit).forEach(n => n.click()),HowManyStudentsToNotClearAttempts)
    
    if(numOfStudents > HowManyStudentsToNotClearAttempts){
        // Remove attempts
        await Promise.all([
            page.waitFor(confirmDialogButton),
            page.click(resetButton)
        ])
        await Promise.all([
            page.waitForNavigation(),
            page.click(confirmDialogButton)
        ])
    }

    // Put the student Cookies back
    await page.deleteCookie(...teacherCookies)
    await page.setCookie(...studentCookies)
}

main()