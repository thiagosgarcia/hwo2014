var Message = require("./message.js");
var Track = require("./track.js");
var Car = require("./car.js");

var message;
var ourCar;
var ourDriver;

function Race() {
    this.message = new Message(this);
}

module.exports = Race;

Race.prototype.init = function(data) {
    track = new Track(data.race.track, data.race.raceSession);
    ourCar.track = track;
}

Race.prototype.createCar = function(data) {
    ourCar = new Car(data);
    ourDriver = ourCar.driver;
}

Race.prototype.run = function(data, gameTick) {
    ourCar.updateCarPosition(data);

    var message = {
        type: null,
        value: null
    };

    message = decideRaceAction(gameTick);

    console.log("tick " + gameTick + " : " + (Math.floor((gameTick / (60) % 100)*100) /100)  + " s"
        +" | speed " + ourCar.lastSpeed
        +" | acc " + ourCar.acceleration
        +" | piece " + ourCar.currentPiece.index + " (" + ourCar.currentPiece.type + ")"
        +" | lap " + ourCar.lap
        +" | nextBend " + ourCar.distanceToBend()
        //+" | lane " + ourCar.lane.index
        //+" | switch " + ourCar.currentPiece.switch
        //+" | Piece: lenght " + ourCar.currentPiece.lengthInLane(ourCar.track.lanes[0], ourCar.track.lanes[1])
        //+" . radius " + ourCar.currentPiece.radius
        //+" . angle " + ourCar.currentPiece.angle
        //+" | nextSwitch " + leftToNextSwitch(piecePosition.pieceIndex, carLane, piecePosition)
    );

    return message;
}

Race.prototype.rechargeTurbo = function(data) {
    ourCar.rechargeTurbo(data);

    console.log("Turbo Recharged! " +
        " | turboDurationTicks " + ourCar.turboDurationTicks +
        " | turboFactor " + ourCar.turboFactor
    );
}

function decideRaceAction(gameTick) {
    var action = {};

    // Only check for turbo and switch sends if the game have already started
    if(isRunning(gameTick)) {

        if(shouldTurbo()) {
            ourCar.turboAvailable = false;

            action.type = 'sendTurbo';
            return action;

        } else if(shouldSwitch()) {
            action.type = 'sendSwitchLane';
            action.value = ourDriver.determineSwitchDirection();

            if(!!action.value)
                return action;
        }

    }

    action.type = 'sendThrottle';
    action.value = ourDriver.drive();

    return action;
}

function isRunning(gameTick) {
    return !!gameTick && !!ourCar.acceleration
}

function shouldTurbo() {
    return ourCar.turboAvailable && ourDriver.canTurbo();
}

function shouldSwitch() {
    if(ourDriver.checkSwitch) {
        ourDriver.checkSwitch = false;
        return true;
    }

    return false;
}