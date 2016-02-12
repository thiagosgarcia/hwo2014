var Logger = require("./logger.js");

var client;
var race;
var car;

function Message(race) {
    this.race = race;

    declarePrivateMethods.call(this);
}

Message.prototype.joinCustomRace = function(parameters) {
    return this.send({
        msgType: "joinRace",
        data: {
            botId: {
                name: parameters.botName,
                key: parameters.botKey,
                color: parameters.color
            },
            trackName: parameters.trackName,
            password: parameters.password,
            carCount: parseInt(parameters.carCount)
        }
    });
};

Message.prototype.joinCustomMultiPlayerRace = function(parameters) {
    return this.send({
        msgType: "joinRace",
        data: {
            botId: {
                name: parameters.botName,
                key: parameters.botKey
            },
            trackName: parameters.trackName,
            password: parameters.password,
            carCount: parseInt(parameters.carCount)
        }
    });
};

Message.prototype.joinOfficialRace = function(parameters) {
    return this.send({
        msgType: "join",
        data: {
            name: parameters.botName,
            key: parameters.botKey
        }
    });
};

Message.prototype.join = function(data) {
    Logger.log('Joined race!');
    this.sendPing();
};

Message.prototype.joinRace = function(data) {
    this.join(data);
};

Message.prototype.yourCar = function(data) {
    this.car = this.race.createCar(data['data']);
    this.sendPing();
};

Message.prototype.gameInit = function(data) {
    this.race.init(data['data']);
    this.sendPing();
};

Message.prototype.gameStart = function(data) {
    Logger.log('Race started!');
    this.sendPing();
};

Message.prototype.carPositions = function(data) {
    Logger.setTick(data['gameTick']);
    action = this.race.run(data['data'], data['gameTick']);
    this[action.type](action.value);
};

Message.prototype.turboAvailable = function(data) {
    this.race.rechargeTurbo(data['data']);
    this.sendPing();
};

Message.prototype.crash = function(data) {
    Logger.log('Crashed! :(');
    this.race.setCrashAngle(data);
    this.sendPing();
};

Message.prototype.spawn = function(data) {
    Logger.log('Respawn! :)');
    this.sendThrottle(1.0);
};

Message.prototype.lapFinished = function(data) {
    Logger.log('Lap finished.');
    this.sendPing();
};

Message.prototype.gameEnd = function(data) {
    Logger.log('Race ended!');
    this.sendPing();
};

Message.prototype.unknownMessage = function(data) {
    Logger.log("Unknown message: ", data);
    this.sendPing();
};

Message.prototype.error = function(data, e) {
    Logger.log("Error!");
    Logger.log(data);
    Logger.log(e.stack);
    this.sendPing();
};


function declarePrivateMethods() {

    this.send = function(json) {
        Logger.refresh(this.car);

        this.client.write(JSON.stringify(json));
        return this.client.write('\n');
    };

    this.sendPing = function() {
        this.send({
            msgType: "ping",
            data: {}
        });
    };

    this.sendThrottle = function(val) {
        if(val > 1.0)
            val = 1.0;
        if(val < 0.0)
            val = 0.0;

        this.send({
            msgType: "throttle",
            data: 1
        });
    };

    this.sendSwitchLane = function(val) {
        Logger.log('Will switch to ' + val + ' lane');

        this.send({
            msgType: "switchLane",
            data: val
        });
    };

    this.sendTurbo = function() {
        this.send({
            msgType: "turbo",
            data: "Geronimoooooo!!!"
        });
    };

}

module.exports = Message;

