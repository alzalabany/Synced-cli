#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const jot = require('json-over-tcp');
const md5File = require('md5-file');
exports.default = {};
// Will read argumments passed
// eg: node ./index.js host=localhost port=2020 dir=../src
const args = require('./args.js').default;

const log = console.log.bind(console);
args.port = args.port || 5050; // default port
let ready = false; // used by server to wait for file watcher to start
const clients = []; // sockets to propagate change to.
const servers = []; // sockets to propagate change to.
let lastMd5=null;
// you must have a .gitignore file or this will fail...
// i leave it to enforce adding node_modules to .gitignore :D !!
const ignoreFile = path.normalize('./.gitignore');
if (!fs.existsSync(ignoreFile)) fs.writeFileSync(ignoreFile, 'node_modules');
const ignored = String(fs.readFileSync(ignoreFile, 'utf8'))
                  .split(/\r?\n/)
                  .concat([/[\/\\]\./]);

// Allow you to set custome dir to watchover :)..
// WARN::for clients only
const DIR = path.normalize(args.dir || '.');

// Start watching folder.. only one folder will ever be needed right !..
const watcher = chokidar.watch(DIR, {
    persistent: true,
    ignored,
    ignoreInitial: false,
    followSymlinks: true,
    cwd: './',
    disableGlobbing: false,
    usePolling: true,
    interval: 100,
    binaryInterval: 300,
    alwaysStat: false,
    depth: 99,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
    ignorePermissionErrors: false,
    atomic: true,
});

console.log('------Watching---------');
console.log(`on ${DIR}`);
console.log(`ignoring ${ignored}`);
process.stdin.resume();
process.stdin.setEncoding('utf8');

/**
 * This will take an order object, and execute
 * Order object is an object that tell fn to update/delete a file
 * it will use file checksum to avoid circular updating
 *
 * @param {Object} data - The {event, file, md5, path} Object.
 * @param {string} data.event - The type of choikdar event
 * @param {string} data.path - The path of file relative to Server root.
 * @param {string} data.file - The file content
 * @param {string} data.md5 - The md5 checksum of file
 *
 * @return {void};
 *
 */
function executeOrder(data) {
  const {event, file, md5} = data;
  let url = path.normalize(DIR+'/'+data.path);
  if ( fs.existsSync(url) ) {
    switch (event) {
      case 'unlink':
        fs.unlinkSync(url);
        return log('client say:file deleted:'+url);
      case 'unlinkDir':
        fs.rmdirSync(url);
        return log('client say:folder deleted:'+url);
      case 'change':
        log('client say:updated file:'+url);
        const current = md5File.sync(url);
        // crypto.createHash('md5').update(file).digest("hex");
        if (md5 !== current) {
          lastMd5 = md5;
          fs.writeFileSync(url, file);
          log('updated');
        } else {
          log('files md5 hash are identical');
        }
        return;
      default:
        log('unkown event although file do exists:'+event, file);
        break;
    }
  } else {
      switch (event) {
        case 'update':
        case 'updated':
        case 'change':
          if (file.length) {
            lastMd5 = md5;
            fs.writeFileSync(url, file);
            return log('updated');
          }
          log('will not update cause file is too short!');
          break;
        default:
          log('unkown event on an unkown file !'+event, file);
          break;
      }
  }
}

/**
 * triggered when ever a client connects to the server
 *
 * will add him, and remove him from clients. and on data will save his work too.
 *
 * @param {Socket} socket
 */
function newConnectionHandler(socket) {
  const idx = clients.push(socket);
  console.log('new connection id#'+idx, socket.address());
  socket.on('close', function() {
    log('socket @'+idx+' closed...');
    clients.splice(idx-1, 1);
    if(clients.length===0){
      log('shutting down..');
      process.exit();
    }
  });
  socket.on('data', function(data) {
    console.log(`[${args.port}][@${idx}]:`, String(data).substr(0, 100));
    if (data.event && data.path) executeOrder(data);
  });
}

/**
 * propagate changes to all connected clients/servers.
 *
 * @param {string} event chokidar event
 * @param {string} md5 md5 of file
 * @param {string} path path relative to server
 * @param {string} file file content
 *
 * @return {void};
 */
function broadcast(event, md5, path, file) {
  if (md5===lastMd5) return log('skipping trying to recircule update for '+md5);
  log(`###broadcasting to ${clients.length} clients### checksum:${md5}`);
  clients.map((socket)=>socket.write({event, md5, path, file}));
}

watcher
  .on('ready', function() {
    log('Initial scan complete. Ready for changes.');
    ready = true;
  })
  .on('all', function(event, p) {
    if (!ready) return;
    console.log('watcher was triggered because', event, p);
    // @@todo this is a BUG !! but it works for now.. we dont support wierd relative --dir option anyway..
    let url = DIR==='.' ? p : path.normalize( p.replace(DIR, '') );
    let md5 = '';
    try {
      md5 = md5File.sync(p);
      broadcast(event, md5, url, fs.readFileSync(p, 'utf8'));
    } catch (error) {
      broadcast(event, md5, url, '');
      console.log('?', error);
    }
  });

function createServer() {
  const server = jot.createServer({port: args.port});
  servers.push(server);
  server.on('listening', ()=>log('started listening @ port '+args.port))
  .on('connection', newConnectionHandler)
  .on('error', (e)=>(e.code === 'EADDRINUSE' && server.listen(++args.port)))
  .listen(args.port);
}

function connectToHost(host){
  const socket = jot.connect({port: args.port, host},function(){
    newConnectionHandler(socket);
  });

}

function start(){
  if (!args.host) {
    console.log('creating server');
    createServer();
  } else {
    console.log(`connecting to server @${args.host}:${args.port}`);
    connectToHost(args.host);
  }
}


const defaults = {
  start,
  createServer,
  connectToHost,
  broadcast,
  newConnectionHandler,
  executeOrder,
  DIR,
  args,
  ignored,
  watcher
}

setTimeout(start,500);

process.stdin.on('data',function(order){
  const exec = order.replace(/\s$/,'');
  switch (exec) {
    case 'info':
      log('servers:', servers.filter(c=>c.address).map(s=>s.address()));
      log('clients:', clients.filter(c=>c.address).map(s=>s.address()));
      break;
    case 'disconnect':
      log('stopping '+clients.length+' clients');
      clients.filter(c=>Boolean(c && c.close)).map(client=>{
        client.close();
      });
    case 'stop':
      log('stopping '+servers.length+' servers');
      servers.map(server=>{
               server.close();
             });
      break;
    case 'start':
      start();
      break;
    default:
      const parts = exec.split('=');
      if(parts.length===2){
        args[parts[0]] = parts[1];
        log(parts[0]+' was defined, new Settings:-');
        log(args);
      }
      if(exports.default[exec])typeof exports.default[exec] === 'function' ? exports.default[exec]() : log(exports.default[exec]);
      break;
  }
});


exports.default = defaults;
