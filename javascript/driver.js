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
    // Target speed to entering bends. It'll be calculated using bend radius and size
    // (to be implemented)
    var targetSpeed = 6.4;

    // BreakingFactor is the relation between speed and negative acceleration when the car is
    // fully breaking in a Straight piece.
    // It'll be calculated for each race when breaking in the firsts bends because of the
    // possibility to have many
    var breakingFactor = 49;

    // This is a delay for breaking. Less, the pilot breaks earlier, more the pilot breaks later.
    // 4 value makes the pilot break pretty securely and close to the bend.
    // Smaller values may be used when the car is in the inner lane, greater when it is in the outer lane
    const breakingTicksDelay = 6;

    var speedDiff = currentSpeed - targetSpeed;
    // If the speed is less than target speed there's no need to break
    if(speedDiff <= 0)
        return false;

    // Calculate the breaking acceleration if the car fully breaks with current speed
    var currentBreakAcceleration = currentSpeed / breakingFactor;
    // Calculate the breaking acceleration in target speed
    var targetBreakAcceleration = targetSpeed / breakingFactor;
    // Calculate the average of both breaking accelerations measured upper
    var breakAccelerationAverage = ((currentBreakAcceleration + targetBreakAcceleration) / 2);
    // Calculate the ticks left to the car get into speedTarget
    var ticksLeftToTargetSpeed = speedDiff / breakAccelerationAverage;
    var ticksLeftToBendOnCurrentSpeed = distanceToBend / currentSpeed;

    //If the car needs more ticks to break than the ticks left to achieve the target speed,
    // then it is time to break, otherwise, step on it!
    if( ticksLeftToBendOnCurrentSpeed + breakingTicksDelay < ticksLeftToTargetSpeed ){
        console.log("ticksLeftToBendOnCurrentSpeed: " + ticksLeftToBendOnCurrentSpeed +
            " ticksLeftToTargetSpeed: " + ticksLeftToTargetSpeed)
        return true;
    }
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
            return 2.0; // to activate turbo in throttle function
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