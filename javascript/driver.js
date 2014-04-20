var Car = require('./car.js');

function Driver() {
}

Driver.prototype.drive = function(car) {
	var currentPiece = car.currentPiece;
    
    if (currentPiece.type == "S") {
    	return this.driveForStraight(car);
    } else if (currentPiece.type == "B") {
        return this.driveForBend(car);
    }

    return 1;
}

function isTimeToBreak(currentSpeed, distanceToBend){
    var targetSpeed = 6.4;
    var speedDiff = currentSpeed - targetSpeed;
    if(speedDiff <= 0)
        return false;

    var currentBreakAcceleration = currentSpeed / 49;
    var targetBreakAcceleration = targetSpeed / 49;
    var breakAccelerationAverage = ((currentBreakAcceleration + targetBreakAcceleration) / 2);
    var ticksLeftToTargetSpeed = speedDiff / breakAccelerationAverage;
    var ticksLeftToBendOnCurrentSpeed = distanceToBend / currentSpeed;

    if( ticksLeftToBendOnCurrentSpeed <= ticksLeftToTargetSpeed )
        return true;
    return false;
}

Driver.prototype.driveForStraight = function(car) {
    var distanceToBend = car.distanceToBend();
    var currentSpeed = car.speed();
    var turboDurationTicks = car.turboDurationTicks;
    var turboFactor = car.turboFactor;

    //if (distanceToBend > Math.pow(currentSpeed, (currentSpeed / 7) + 1)) {
    if ( !isTimeToBreak(currentSpeed, distanceToBend)){

        // To use more efficiently the turbo, the driver will only activate it when the time left
        // to get to the bend with the turbo speed is greater than the turbo timeout
        if(car.turboAvailable && distanceToBend / (currentSpeed * turboFactor) > turboDurationTicks){
            car.turboAvailable = false;
            return 2; // to activate turbo in throttle function
        }

    	return 1.0;
    } else if (currentSpeed < 6.4) {
    	return 0.5;
    }
    
    return 0.0;
}

Driver.prototype.driveForBend = function(car) {
    var currentSpeed = car.speed();
    var currentAcc = car.acceleration;

	if (currentSpeed < 6.5) {
        return 1.0;
	} else if (currentAcc < 0) {
		return 0.0;
	}
    
	return 0.0;
}

module.exports = Driver;