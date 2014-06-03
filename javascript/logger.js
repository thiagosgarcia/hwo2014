var throttle;
var speed;
var speedAcceleration;
var angle;
var angleAcceleration;
var pieceIndex;
var nextBendPieceIndex;
var nextBendBendIndex;
var nextBendTargetLane;
var nextBendTargetSpeed;
var logs;

var counter;

var myLogger;

function Logger(serverName) {
    if(this.myLogger instanceof Logger)
        throw new Exception("Logger is singleton!");
    this.myLogger = this;

    this.track = "";
    this.tick = 0;
    this.timePassed = 0;
    this.throttle = "";
    this.currentLap = 1;
    this.totalLaps = Infinity;
    this.speed = "";
    this.averageSpeed = "";
    this.speedAcceleration = "";
    this.angle = "";
    this.angleAcceleration = "";
    this.pieceIndex = "";
    this.nextBendPieceIndex = "";
    this.nextBendBendIndex = "";
    this.nextBendTargetLane = "";
    this.targetSpeed = "";
    this.nextBendDistance = "";
    this.distanceToNextBend = "";
    this.logs = [];

    this.counter = 0;

    declarePrivateMethods.call(this);
}

Logger.getInstance = function() {
    if(!(myLogger instanceof Logger)) {
        myLogger = new Logger();
    }
    return myLogger;
};

Logger.log = function () {
    Logger.getInstance();
    myLogger.logs.push(arguments);
};

Logger.refresh = function(car) {
    Logger.getInstance();
    if(!!car) {
        myLogger.currentLap = car.lap + 1;
        myLogger.totalLaps = (!!car.track) ? car.track.laps : "";
        myLogger.speed = car.currentSpeed;
        myLogger.averageSpeed = car.averageSpeed;
        myLogger.speedAcceleration = car.acceleration;
        myLogger.angle = car.angle;
        myLogger.angleAcceleration = car.angleSpeed;
        myLogger.pieceIndex = (!!car.currentPiece) ? (car.currentPiece.index + " (" + car.currentPiece.type + ")") : "";
        myLogger.nextBendPieceIndex = (!!car.bendsAhead[0]) ? car.bendsAhead[0].index : "";
        myLogger.nextBendBendIndex = (!!car.bendsAhead[0]) ? car.bendsAhead[0].bendIndex : "";
        myLogger.distanceToNextBend = (!!car.currentPiece) ? car.distanceToBend() : "";
        myLogger.nextBendTargetLane = (!!car.nextLane) ? car.nextLane.index : "";
        myLogger.targetSpeeds = (!!car.bendsAhead[0] && !!car.bendsAhead[0].targetSpeeds) ? car.bendsAhead[0].targetSpeeds : "";
    }

    myLogger.print();
};

Logger.setTrack = function(track) {
    Logger.getInstance();
    myLogger.track = track;
};

Logger.setTick = function(tick) {
    Logger.getInstance();
    if(tick == undefined) {
        myLogger.tick = 0;
        myLogger.timePassed = 0;
    }
    else {
        myLogger.tick = tick;
        myLogger.timePassed = (Math.floor((tick / (60) % 100)*100) / 100);
    }
};

Logger.setThrottle = function(throttle) {
    Logger.getInstance();
    myLogger.throttle = throttle;
};

Logger.setTargetSpeed = function(targetSpeed) {
    Logger.getInstance();
    myLogger.targetSpeed = targetSpeed;
};

Logger.setBreakingFactor = function(breakingFactor) {
    Logger.getInstance();
    myLogger.breakingFactor = breakingFactor;
};

function declarePrivateMethods() {

    this.outputTemplate =
        "Track:                         %track%\n\
        Tick:                         %tick%\n\
        Time:                         %timePassed%\n\
        Lap:                          %currentLap%/%totalLaps%\n\
        Target speed:                 %targetSpeed%\n\
        Breaking factor:              %breakingFactor%\n\
        Throttle:                     %throttle%\n\
        Speed:                        %speed%\n\
        Average Speed:                %averageSpeed%\n\
        Speed acceleration:           %speedAcceleration%\n\
        Angle:                        %angle%\n\
        Angle acceleration:           %angleAcceleration%\n\
        Piece:                        %pieceIndex%\n\
        Next bend:                    %nextBendPieceIndex%-%nextBendBendIndex%\n\
        Distance to next bend:        %distanceToNextBend%\n\
        Next lane:                    %nextBendTargetLane%\n\
        \n\
        %speedGauge%\n\
        %bendGauge%\n\
        \n\
        Logs:\n";

    this.print = function() {
        output = this.outputTemplate;
        output = output.replace("%track%", this.track);
        output = output.replace("%tick%", this.tick);
        output = output.replace("%timePassed%", this.timePassed + "s");
        output = output.replace("%currentLap%", this.currentLap);
        output = output.replace("%totalLaps%", this.totalLaps);
        output = output.replace("%targetSpeed%", this.targetSpeed);
        output = output.replace("%breakingFactor%", this.breakingFactor);
        output = output.replace("%throttle%", this.throttle);
        output = output.replace("%speed%", this.speed);
        output = output.replace("%averageSpeed%", this.averageSpeed);
        output = output.replace("%speedAcceleration%", this.speedAcceleration);
        output = output.replace("%angle%", this.angle);
        output = output.replace("%angleAcceleration%", this.angleAcceleration);
        output = output.replace("%pieceIndex%", this.pieceIndex);
        output = output.replace("%nextBendPieceIndex%", this.nextBendPieceIndex);
        output = output.replace("%nextBendBendIndex%", this.nextBendBendIndex);
        output = output.replace("%distanceToNextBend%", this.distanceToNextBend);
        output = output.replace("%nextBendTargetLane%", this.nextBendTargetLane);

        output = output.replace("%speedGauge%", this.updateSpeedGauge());
        output = output.replace("%bendGauge%", this.updateBendGauge());

        process.stdout.write("\033[2J"); // clear screen
        process.stdout.write("\033[0;0H"); // send cursor to top
        process.stdout.write(output);


        this.printLogs();
    };

    this.updateSpeedGauge = function() {
        Logger.getInstance();
        var gauge = "0";
        var speed = parseFloat(myLogger.speed);
        var factor = 20 / 119;
        var i = 0.0;
        while( i <= 20){
            i += factor;
            if( Math.ceil(i + factor) == Math.floor(i + factor * 2) && parseInt(i) == 9){
                gauge += (speed > 10 ? "|" : ".") + speed.toFixed(2);
                i+= speed < 10 ? factor * 5 : factor * 6;
                continue;
            }
            if(i < speed)
                gauge += "|";
            else
                gauge += ".";
        }
        gauge += Math.floor(i);
        if(speed > i)
            gauge += " >> "
        return gauge;
    };

    this.updateBendGauge = function() {
        Logger.getInstance();
        var gauge = "";
        var angle = myLogger.angle * -1;
        var i = -62;
        while (++i < 62){
            if(i == -61){
                gauge += "L";
                continue;
            }
            if(i == 61){
                gauge += "R";
                continue;
            }
            if(i == 0){
                gauge += "C";
                continue;
            }
            if(i < 0){
                if( i < angle)
                    gauge += ".";
                else
                    gauge += "|";
            }else{
                if( i > angle)
                    gauge += ".";
                else
                    gauge += "|";
            }

        }
        return gauge;
    };

    this.printTargetSpeeds = function () {
        if(!(this.targetSpeeds instanceof Array))
            return "";
        var targetSpeeds = "";
        var count = this.targetSpeeds.length;
        for(i = 0; i < count; i++) {
            targetSpeeds += this.targetSpeeds[i] + " ";
        }
        return targetSpeeds;
    }

    this.printLogs = function() {
        var logCount = this.logs.length;
        for(i = 0; i < logCount; i++) {
            console.log.apply(this, this.logs[i]);
        }
        this.logs = [];
    }
}

module.exports = Logger;
