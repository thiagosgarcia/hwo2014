var Car = require('./car.js');

function Driver(car) {
	this.car = car;
	this.checkSwitch = true;
}

// ***** Throttle intelligence ***** //

Driver.prototype.drive = function() {
	var currentPiece = this.car.currentPiece;
    
    if (currentPiece.type == "S") {
    	return this.driveForStraight();
    } else if (currentPiece.type == "B") {
        return this.driveForBend();
    }

    return 1;
}

function isTimeToBreak(currentSpeed, distanceToBend){
    // Target speed to entering bends. It'll be calculated using bend radius and size
    // (to be implemented)
    var targetSpeed = 6.5;

    // BreakingFactor is the relation between speed and negative acceleration when the car is
    // fully breaking in a Straight piece.
    // It'll be calculated for each race when breaking in the firsts bends because of the
    // possibility to have a value for each track
    var breakingFactor = 49;

    // This is a delay for breaking. Less, the pilot breaks earlier, more the pilot breaks later.
    // 4 - 5 value makes the pilot break pretty securely and close to the bend.
    // Smaller values may be used when the car is in the inner lane, greater when it is in the outer lane
    // carefully, of course
    const breakingTicksDelay = 5;

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

Driver.prototype.driveForStraight = function() {
	var car = this.car;
    var distanceToBend = car.distanceToBend();
    var currentSpeed = car.speed();

    if ( !isTimeToBreak(currentSpeed, distanceToBend) || car.inLastStraight()){
    	return 1.0;
    } else if (currentSpeed < 6.5) {
    	return 0.5;
    }
    
    return 0.0;
}

Driver.prototype.driveForBend = function() {
    var currentSpeed = this.car.speed();
    var currentAcc = this.car.acceleration;

	if (currentSpeed < 6.425) {
        return 1.0;
	} else if (currentAcc < 0) {
		return 0.0;
	}
    
	return 0.0;
}

// ***** Turbo intelligence ***** //

// Determine, by the car position in the track, if this tick is the right moment
// to use the active turbo;
Driver.prototype.canTurbo = function() {
	var car = this.car;
	var currentPiece = car.currentPiece;
	var currentAcc = this.car.acceleration;
	
	// If the car is breaking (acc <= 0.0), the turbo will not be optmized
	if(currentAcc <= 0.0)
		return false;
	
	// If the currentPiece the car is on is a Bend, we have to check if the car is on its exit;
	if(currentPiece.type == "B") {
		// Check if the car is on the last half of the Bend;
		var bendLength = currentPiece.lengthInLane(car.lane);
		if(car.inPieceDistance < (bendLength / 2))
			return false;
		
		// Check if the car angle is low enough to be safe to use the turbo
		if(car.angle > 45.0 || car.angle < -45.0)
			return false;
	}
	
	var distanceToBend = car.distanceToBend();
	// The distance the car will travel while on turbo is determined by the following formula:
	// Distance = Acc * TurboFactor * (Duration ^ 2)
	var distanceInTurbo = (2 * currentAcc * car.turboFactor * Math.pow(car.turboDuration, 2));
	// We have to know as well at what distance from the bend the car will begin to break...
	
	// If the distance to the next bend is greater than the distance the car will travel in Turbo, turbo away!
	return (distanceToBend > distanceInTurbo);
}

// ***** Switch intelligence ***** //

// This algorithm will sum the length of all the lanes in the bends between two switches,
// and send the switch message to the direction of the lane with the shorter length.
// The less ground to cross, the lesser the time to cross it;
Driver.prototype.determineSwitchDirection = function() {
	var car = this.car; 
	var nextBends = new Array();
	var nextSwitch = null;
	
	var nextPieceIndex = car.currentPiece.index + 1;
	while(true) {
		if(car.track.pieces.length <= nextPieceIndex)
			nextPieceIndex = 0;
		
		var nextPiece = car.track.pieces[nextPieceIndex];
	
		if(nextPiece.switch) {
			// Found the second switch, after one or more bend pieces were found in between them. Stop the loop;
			if(!!nextSwitch && nextBends.length > 0) break;
			
			// Found the first switch, assign it to nextSwitch;
			nextSwitch = nextPiece;
		} 
		
		if (nextPiece.type == "B") {
			// Found a bend before a switch, break;
			if(nextSwitch == null) break;
		
			nextBends.push(nextPiece);
		}
		
		nextPieceIndex++;
	}
	
	// Only calculate the direction if a switch were found before the next bend.
	if(!!nextSwitch && nextBends.length > 0) {
		var lanes = car.track.lanes;
		var shorterLane = null;
		
		// Determine the shorter lane in the bends after the nextSwitch
		for(var i = 0; i < lanes.length; i++) {
			var lane = lanes[i];
			var laneLength = 0;
			
			for(var j = 0; j < nextBends.length; j++) {
				var bend = nextBends[j];
				laneLength += bend.lengthInLane(lane);
			}
			
			if(shorterLane == null || laneLength < shorterLane.length) {
				shorterLane = lane;
				shorterLane.length = laneLength;
			}
		}
		
		// The shorter lane is more to the left of the center, switch Left.
		if(car.lane.distanceFromCenter > shorterLane.distanceFromCenter) {
			return 'Left';
		}
		// The shorter lane is more to the right of the center, switch Right.
		else if(car.lane.distanceFromCenter < shorterLane.distanceFromCenter) {
			return 'Right';
		}
		
		// The lane the car is driving is already the shorter! Nothing to do here..
	}
	
	return null;
}

module.exports = Driver;
