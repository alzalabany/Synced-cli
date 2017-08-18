# Syncer

sync current folder with friends to work together and get live updates

## WARNING : BETA STUFF.. for playing

## Getting Started

```
> npm install -g syncer-cli
```
Thats it :) !. now you can use it from any folder in your computer

## Usage example

### start server inside folder

```
> syncer
```

### connect using a client from another machine/folder

```
syncer port=2020 host=192.168.1.5
```

after starting syncer, you can also send commands to it to update its internals !!

- you can connect to as many servers as you want
- you can connect as many clients as you want

example

```shell
> syncer
  watching ./ folder
  ignoring node_modules,.vscode,.git,/[\/\\]\./
  Initial scan complete. Ready for changes.
  creating server
  started listening @ port 5051
info
  servers: [ { address: '::', family: 'IPv6', port: 5051 } ]
  clients: []
host=localhost
  host was defined, new Settings:-
  { port: 5051, host: 'localhost' }
start
    connecting to server @localhost:5051
  new connection id#1 { address: '127.0.0.1', family: 'IPv4', port: 51429 }
  new connection id#2 { address: '::ffff:127.0.0.1', family: 'IPv6', port: 5051 }
info
  servers: [ { address: '::', family: 'IPv6', port: 5051 } ]
  clients: [
    { address: '127.0.0.1', family: 'IPv4', port: 51429 },
    { address: '::ffff:127.0.0.1', family: 'IPv6', port: 5051 }
  ]
start
  connecting to server @localhost:5051
  new connection id#3 { address: '127.0.0.1', family: 'IPv4', port: 51464 }
  new connection id#4 { address: '::ffff:127.0.0.1', family: 'IPv6', port: 5051 }
stop
  stopping 1 servers
info
  servers: [ null ]
  clients: [
    { address: '127.0.0.1', family: 'IPv4', port: 51429 },
    { address: '::ffff:127.0.0.1', family: 'IPv6', port: 5051 }
  ]
disconnect
  stopping 3 clients
  stopping 1 servers
ctrl+c to end
```



### Development

```
1. git clone git@gitlab.com:alzalabany/syncer.git
2. cd syncer && npm install;
3. chmod +x ./index.js <---------------- you might need to do that if u got "cannot execute file" permission denied
4. npm install -g;
5. thats it, use it from anywhere on your computer ! also if u update index.js, your installation will update automaticlly.
```

## create server


## create client


## monitor folder


## update folder