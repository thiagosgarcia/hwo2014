var Logger = require("./logger.js");
var Message = require("./message.js");
var Track = require("./track.js");
var Car = require("./car.js");

var message;
var ourCar;
var ourDriver;

function Race() {
    this.message = new Message(this);

    declarePrivateMethods.call(this);
}

Race.prototype.init = function(data) {
    track = new Track(data.race.track, data.race.raceSession);
    Logger.setTrack(data.race.track.name)
    ourCar.track = track;
};

Race.prototype.createCar = function(data) {
    ourCar = new Car(data);
    ourDriver = ourCar.driver;
    return ourCar;
};

Race.prototype.run = function(data, gameTick) {
    var initialTime = new Date();
    ourCar.updateCarPosition(data);
    var message = {
        type: null,
        value: null
    };

    message = this.decideRaceAction(gameTick);
    Logger.setTimeDifference(new Date().getMilliseconds() - initialTime.getMilliseconds());
    return message;
};

Race.prototype.setCrashAngle = function(data) {
    if(ourCar.name == data.name)
        ourCar.setCrashAngle();
};

Race.prototype.rechargeTurbo = function(data) {
    ourCar.rechargeTurbo(data);

    Logger.log("Turbo Recharged! " +
        " | turboDurationTicks " + ourCar.turboDurationTicks +
        " | turboFactor " + ourCar.turboFactor
    );
};

function declarePrivateMethods() {

    this.decideRaceAction = function(gameTick) {
        var action = {};

        // Only check for turbo and switch sends if the game have already started
        if(this.isRunning(gameTick)) {

            if(this.shouldTurbo()) {
                ourCar.turboAvailable = false;

                action.type = 'sendTurbo';
                return action;

            } else if(this.shouldSwitch()) {
                action.type = 'sendSwitchLane';
                action.value = ourDriver.determineSwitchDirection();

                if(!!action.value)
                    return action;
            }

        }

        action.type = 'sendThrottle';
        action.value = ourDriver.drive();
        Logger.setThrottle(action.value);

        return action;
    };

    this.isRunning = function(gameTick) {
        return !!gameTick && !!ourCar.acceleration
    };

    this.shouldTurbo = function() {
        return ourCar.turboAvailable && ourDriver.canTurbo();
    };

    this.shouldSwitch = function() {
        if(ourDriver.checkSwitch) {
            ourDriver.checkSwitch = false;
            return true;
        }

        return false;
    };
}

module.exports = Race;