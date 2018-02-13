const Handlebars = require('handlebars')
const fs = require('fs')
const moment = require('moment')
const path = require('path')
const opn = require('opn')

const handlebarsFile = path.join(__dirname,'index.hbs')
const dataFile = path.join(__dirname,'data.json')
const htmlOutputFile = path.join(__dirname,'index.html')

Handlebars.registerHelper('Date',datestring => {
    return moment(datestring).format('MMM Do h:mm:ss a')
})

Handlebars.registerHelper('picture',path => {
    return `<a target="_blank" href="${path}">${path.match(/([a-zA-Z]+)\.png$/)[1]}</a>`
})

Handlebars.registerHelper('isBad',function(){
    if(this.afterAttemptNumber - this.beforeAttemptNumber != 1 || 
        this.afterAttemptNumber !== this.listAttemptNumber){
        return 'class="negative"'
    }
})

function main(){
    var template = Handlebars.compile(fs.readFileSync(handlebarsFile,'utf-8'))
    
    var data = JSON.parse(fs.readFileSync(dataFile,'utf-8'))
    
    var html = template(data)
    
    fs.writeFileSync(htmlOutputFile,html)

    opn(htmlOutputFile)
}

module.exports = main

if (require.main === module) {
    main()
}