const http = require('http');
const fs = require('fs');
const path = require('path');
const { parse: parseurl } = require('url');
const cp = require('child_process');

const port = process.env.PORT || 8995;

const preparedOptions = {};

const route = {
  '/': 'index.html',
  '/remote-shell.js': 'client.js',
  '/prepare': (req, res, url) => {
    res.writeHead(200, {
      'access-control-allow-origin': '*',
      'content-type': 'text/plain; charset=utf-8',
    });
    const chunks = [];
    req.on('data', chunk => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      const options = Buffer.concat(chunks).toString();
      const id = uid();
      preparedOptions[id] = options;
      res.end(id);
      setTimeout(function () {
        delete preparedOptions[id];
      }, 5000);
    });
  },
  '/listen': (req, res, url) => {
    res.writeHead(200, {
      'access-control-allow-origin': '*',
      'content-type': 'text/event-stream; charset=utf-8',
    });
    const id = url.search ? url.search.substr(1) : '';
    if (!id || !preparedOptions[id]) {
      res.write('event: output\r\n');
      res.write('data: {"type":"error","message":"job expired or not prepared"}\r\n');
      res.write('\r\n');
      res.write('event: finish\r\n');
      res.write('data: -1\r\n');
      res.write('\r\n');
      setTimeout(() => {
        res.end();
      }, 1000);
    } else {
      const options = preparedOptions[id];
      delete preparedOptions[id];
      res.write('event: output\r\n');
      res.write('data: {"type":"info","message":"forking..."}\r\n');
      res.write('\r\n');
      const process = cp.fork(require.resolve('./executor'), [options]);
      process.on('message', message => {
        if (message.event) {
          res.write(`event: ${message.event}\r\n`);
          res.write(`data: ${message.data}\r\n`);
          res.write('\r\n');
        }
      });
      process.on('close', code => {
        res.write('event: finish\r\n');
        res.write(`data: ${typeof code === 'number' ? code : -1}\r\n`);
        res.write('\r\n');
        setTimeout(() => {
          res.end()
        }, 1000);
      });
    }
  },
  '/execute': (req, res, url) => {
    res.writeHead(200, {
      'access-control-allow-origin': '*',
      'content-type': 'text/plain; charset=utf-8',
    });
    const chunks = [];
    req.on('data', chunk => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      const options = Buffer.concat(chunks).toString();
      const process = cp.fork(require.resolve('./executor'), [options]);
      process.on('message', message => {
        if (message.event) {
          if (message.event === 'output') {
            res.write(JSON.parse(message.data).message);
          }
        }
      });
      process.on('close', code => {
        res.end(`\nEnded with code ${code}`);
      });
    });
  },
};

function uid () {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function requestHandler (req, res) {
  console.log(req.method, req.url);
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'x-server': 'cicily',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST',
      'access-control-allow-headers': 'content-type, x-requested-with, x-requested-by',
    });
    res.end();
    return;
  }
  const url = parseurl(`http://${req.headers.host}${req.url}`);
  const handler = route[url.pathname];
  if (typeof handler === 'string') {
    const stream = fs.createReadStream(path.join(__dirname, 'assets', handler));
    stream.pipe(res, { end: false });
    stream.on('end', () => {
      if (/.js$/.test(url.pathname)) {
        res.end(`('${req.headers.host}')`);
      } else {
        res.end();
      }
    });
  } else if (handler) {
    handler(req, res, url);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
}

const server = http.createServer(requestHandler);
server.listen(port, () => {
  console.log('Listening on port', port);
});
