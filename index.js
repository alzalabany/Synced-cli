'strict mode';
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const jot = require('json-over-tcp');
const md5File = require('md5-file');

// Will read argumments passed
// eg: node ./index.js host=localhost port=2020 dir=../src
const args = require('./args.js').default;

const log = console.log.bind(console);
let serverPort = args.port || 5050; // default port
let ready = false; // used by server to wait for file watcher to start
const clients = []; // sockets to propagate change to.

// you must have a .gitignore file or this will fail...
// i leave it to enforce adding node_modules to .gitignore :D !!
const ignored = String(fs.readFileSync('./.gitignore', 'utf8'))
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
          fs.writeFileSync(url, file);
          log('updated');
          return;
        default:
          log('unkown event on an unkown file !'+event, file);
          break;
      }
  }
}

// Triggered whenever something connects to the server
function newConnectionHandler(socket) {
  const idx = clients.push(socket);
  console.log('new connection id#'+idx);
  socket.on('close', function(data) {
    clients.splice(idx-1, 1);
  });
  socket.on('data', function(data) {
    console.log(`[${serverPort}]message from client:`, data);
    executeOrder(data);
  });
}

function handleError(e) {
  console.log('error happened server is listening:' + server.listening);
  if (e.code === 'EADDRINUSE') {
    // port already in use;
    server.listen(++serverPort);
  }
}

/**
 *  i will broadcast changes to eveery socket in clients array
 * @param {*string} event
 * @param {*string} path
 * @param {*string} file
 */
function broadcast(event, md5, path, file) {
  log('###'+(args.host?'client broadcasting':'server')+'###'+clients.length+'@@'+md5);
  clients.map((socket)=>socket.write({event, md5, path, file}));
}
watcher
  .on('ready', function() {
    log('Initial scan complete. Ready for changes.');
    ready = true;
  })
  .on('all', function(event, p) {
    if (!ready) return log(event);
    console.log('watcher was triggered because', event, p);
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

if (args.host) {
  const server = jot.createServer({port: serverPort});
  server.on('listening', ()=>log('started listening @ port '+serverPort));
  server.on('connection', newConnectionHandler);
  server.on('error', handleError);
  server.listen(serverPort);
} else {
  const server = jot.connect({port: serverPort, args.host});
  server.on('error', handleError);
  clients.push(server);
  server.on('data', function(data) {
    console.log(`[${serverPort}]message from server:`, String(data).substr(0, 100));
    if(data.event && data.path) executeOrder(data);
  });
}
