var client;
var race;

function Message(race) {
    this.race = race;

    declarePrivateMethods(this);
}

Message.prototype.joinCustomRace = function(parameters) {
    return this.send({
        msgType: "joinRace",
        data: {
            botId: {
                name: parameters.botName,
                key: parameters.botKey
            },
            trackName: parameters.trackName,
            password: parameters.password,
            carCount: parameters.carCount,
            color: parameters.color
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
    console.log('Joined race!');
    this.sendPing();
};

Message.prototype.yourCar = function(data) {
    this.race.createCar(data['data']);
    this.sendPing();
};

Message.prototype.gameInit = function(data) {
    this.race.init(data['data']);
    this.sendPing();
};

Message.prototype.gameStart = function(data) {
    console.log('Race started!');
    this.sendPing();
};

Message.prototype.carPositions = function(data) {
    action = this.race.run(data['data'], data['gameTick']);
    this[action.type](action.value);
};

Message.prototype.turboAvailable = function(data) {
    this.race.rechargeTurbo(data['data']);
    this.sendPing();
};

Message.prototype.lapFinished = function(data) {
    console.log('Lap finished.');
    this.sendPing();
};

Message.prototype.gameEnd = function(data) {
    console.log('Race ended!');
    this.sendPing();
};

Message.prototype.unknownMessage = function(data) {
    console.log("Unknown message: ", data);
    this.sendPing();
};

function declarePrivateMethods(obj) {

    obj.send = function(json) {
        this.client.write(JSON.stringify(json));
        return this.client.write('\n');
    };

    obj.sendPing = function() {
        obj.send({
            msgType: "ping",
            data: {}
        });
    };

    obj.sendThrottle = function(val) {
        if(val > 1.0)
            val = 1.0;
        if(val < 0.0)
            val = 0.0;

        console.log("throttle " + val);

        obj.send({
            msgType: "throttle",
            data: val
        });
    };

    obj.sendSwitchLane = function(val) {
        console.log('Will switch to ' + val + ' lane');

        obj.send({
            msgType: "switchLane",
            data: val
        });
    };

    obj.sendTurbo = function() {
        obj.send({
            msgType: "turbo",
            data: "Geronimoooooo!!!"
        });
    };

};

module.exports = Message;

