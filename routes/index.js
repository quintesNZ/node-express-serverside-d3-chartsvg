var express = require('express');
var d3 = require('d3');
var router = express.Router();
const path = require('path');
var jsdom = require('jsdom');
const { JSDOM } = jsdom;

//dont forget redis
//docker run --name node-redis -p 6379:6379 -d redis:alpine
var kue = require('kue');
var jobs = kue.createQueue();
var redis = require('redis');
var client = redis.createClient();
//var client = redis.createClient(port, host);
client.on('connect', function() {
    console.log('Redis client connected');
});

client.on('error', function (err) {
    console.log('Something went wrong ' + err);
});

//borrowed from https://github.com/d3-node/d3-node/blob/master/src/index.js
function fixXmlCase (text) {
  // Fix a jsdom issue where all SVG tagNames are lowercased:
  // https://github.com/tmpvar/jsdom/issues/620
  var tagNames = ['linearGradient', 'radialGradient', 'clipPath', 'textPath']
  for (var i = 0, l = tagNames.length; i < l; i++) {
    var tagName = tagNames[i]
    text = text.replace(
      new RegExp('(<|</)' + tagName.toLowerCase() + '\\b', 'g'),
      function (all, start) {
        return start + tagName
      })
  }
  return text
}

function generateSVG(date, reportID)
{
    console.log("[generateSVG] " + date + "," + reportID);
    const margin = 60;
    const width = 1000 ;- 2 * margin;
    const height = 600 ;- 2 * margin;
            
    const {document} = (new JSDOM('')).window;
    //const dom = new document.JSDOM(`<!DOCTYPE html><p>Dunno If I need this</p>`);
    //global.document = document;
    //global.window = document.defaultView;

    let d3Element = d3.select(document.body);
    let window = document.defaultView

    var chartWidth = 500, chartHeight = 500;    
    
    const svg = d3Element.append('svg').attr('xmlns', 'http://www.w3.org/2000/svg');

    if (width && height) {
    svg.attr('width', width)
      .attr('height', height)
    }
    //chart sample from https://jsfiddle.net/matehu/w7h81xz2/
    //this should be passed from data layer
    const sample = [
    {
    language: 'Rust',
    value: 78.9,
    color: '#000000'
    },
    {
    language: 'Kotlin',
    value: 75.1,
    color: '#00a2ee'
    },
    {
    language: 'Python',
    value: 68.0,
    color: '#fbcb39'
    },
    {
    language: 'TypeScript',
    value: 67.0,
    color: '#007bc8'
    },
    {
    language: 'Go',
    value: 65.6,
    color: '#65cedb'
    },
    {
    language: 'Swift',
    value: 65.1,
    color: '#ff6e52'
    },
    {
    language: 'JavaScript',
    value: 61.9,
    color: '#f9de3f'
    },
    {
    language: 'C#',
    value: 60.4,
    color: '#5d2f8e'
    },
    {
    language: 'F#',
    value: 59.6,
    color: '#008fc9'
    },
    {
    language: 'Clojure',
    value: 59.6,
    color: '#507dca'
    }
    ];

    //draw from sample chart on blocks
    const chart = svg.append('g').attr('transform', 'translate(${margin}, ${margin})');

    const xScale = d3.scaleBand()
        .range([0, width])
        .domain(sample.map((s) => s.language))
        .padding(0.2)
    
    const yScale = d3.scaleLinear().range([height, 0]).domain([0, 100]);
    const makeYLines = () => d3.axisLeft().scale(yScale)
    chart.append('g').attr('transform', 'translate(0, ${height})').call(d3.axisBottom(xScale));
    chart.append('g').call(d3.axisLeft(yScale));  
    chart.append('g').attr('transform', `translate(0, ${height})`).call(d3.axisBottom(xScale));
      chart.append('g')
      .attr('class', 'grid')
      .call(makeYLines()
        .tickSize(-width, 0, 0)
        .tickFormat('')
      )

    const barGroups = chart.selectAll()
      .data(sample)
      .enter()
      .append('g')

    barGroups
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (g) => xScale(g.language))
      .attr('y', (g) => yScale(g.value))
      .attr('height', (g) => height - yScale(g.value))
      .attr('width', xScale.bandwidth())
      .on('mouseenter', function (actual, i) {
        d3.selectAll('.value')
          .attr('opacity', 0)

        d3.select(this)
          .transition()
          .duration(300)
          .attr('opacity', 0.6)
          .attr('x', (a) => xScale(a.language) - 5)
          .attr('width', xScale.bandwidth() + 10)

        const y = yScale(actual.value)

        line = chart.append('line')
          .attr('id', 'limit')
          .attr('x1', 0)
          .attr('y1', y)
          .attr('x2', width)
          .attr('y2', y)

        barGroups.append('text')
          .attr('class', 'divergence')
          .attr('x', (a) => xScale(a.language) + xScale.bandwidth() / 2)
          .attr('y', (a) => yScale(a.value) + 30)
          .attr('fill', 'white')
          .attr('text-anchor', 'middle')
          .text((a, idx) => {
            const divergence = (a.value - actual.value).toFixed(1)
            
            let text = ''
            if (divergence > 0) text += '+'
            text += `${divergence}%`

            return idx !== i ? text : '';
          })

      })
      .on('mouseleave', function () {
        d3.selectAll('.value')
          .attr('opacity', 1)

        d3.select(this)
          .transition()
          .duration(300)
          .attr('opacity', 1)
          .attr('x', (a) => xScale(a.language))
          .attr('width', xScale.bandwidth())

        chart.selectAll('#limit').remove()
        chart.selectAll('.divergence').remove()
      })

    barGroups 
      .append('text')
      .attr('class', 'value')
      .attr('x', (a) => xScale(a.language) + xScale.bandwidth() / 2)
      .attr('y', (a) => yScale(a.value) + 30)
      .attr('text-anchor', 'middle')
      .text((a) => `${a.value}%`)
    
    svg
      .append('text')
      .attr('class', 'label')
      .attr('x', -(height / 2) - margin)
      .attr('y', margin / 2.4)
      .attr('transform', 'rotate(-90)')
      .attr('text-anchor', 'middle')
      .text('Love meter (%)')

    svg.append('text')
      .attr('class', 'label')
      .attr('x', width / 2 + margin)
      .attr('y', height + margin * 1.7)
      .attr('text-anchor', 'middle')
      .text('Languages')

    svg.append('text')
      .attr('class', 'title')
      .attr('x', width / 2 + margin)
      .attr('y', 40)
      .attr('text-anchor', 'middle')
      .text('Most loved programming languages 2018 for ' +  reportID + ' at ' + date)

    svg.append('text')
      .attr('class', 'source')
      .attr('x', width - margin / 2)
      .attr('y', height + margin * 1.7)
      .attr('text-anchor', 'start')
      .text('Source: Stack Overflow, 2018')
    //end from https://jsfiddle.net/matehu/w7h81xz2/
    
    var svgitem ;
    const jsDom = require('jsdom')
    
    if (d3Element.select('svg').node()) {
        //borrowed from https://github.com/d3-node/d3-node/blob/master/src/index.js
        // temp until: https://github.com/tmpvar/jsdom/issues/1368
        svgitem =  fixXmlCase(d3Element.select('svg').node().outerHTML)
    }
    
    return svgitem;
}

//d3 server side demo
router.get('/d3', function (req, res) {
    console.log("Got a GET request for the d3");
    console.log(req.query.dt);
    //what time came through qa
    var time = req.query.dt;
    var date = new Date(parseInt(time));
    res.setHeader('Content-Type', 'image/svg+xml')
    console.log("starting");
    svgitem = generateSVG(date, req.query.name);
    console.log(svgitem);
    res.writeHead(200);
    // I tried sending dataURI back..
    //"data:image/svg+xml;charset=UTF-8," +  
    // this works though
    res.end(svgitem)
  
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname+'/../demo.html'));
  //res.render('index', { title: 'Express' });
});

router.get('/graph', function(req, res, next) {
  res.render('graph', { title: 'graph' });
});

router.get('/demo',function(req,res) {
  res.sendFile(path.join(__dirname+'/../demo.html'));
});

router.get('/queuedemo',function(req,res) {
  res.sendFile(path.join(__dirname+'/../demo2.html'));
});

router.get('/addjob',function(req,res) {
  var job = jobs.create('new_job', { name : req.query.name, dt : req.query.dt });
  job.save();  
  res.end("added a job..");
});

router.get('/getjob',function(req,res) {
  client.get(req.query.reportname, function (error, result) {
    if (error) {
        console.log(error);
        res.statusCode = 503;
        res.write("{data:'" + error + "'}");
        res.end();
    }
    console.log('GET result ->' + result);
        if(result == null)
        {          
          res.statusCode = 404;
          res.write("{data:'not available'}");
          res.end();
        }
        else
        {
        res.end(result);
        }
    });
});


jobs.process('new_job', function (job, done){
    console.log('Job', job.id, 'is done with name [' + job.data.name + ']');
    //what time came through qa
    var time = job.data.dt;
    var date = new Date(parseInt(time));    
    svgitem = generateSVG(date, job.data.name);
    client.set(job.data.name, svgitem, "EX", 10);
    done && done();
})

module.exports = router;
