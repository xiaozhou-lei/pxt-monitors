enum rotation_direction {
    //% block="none"
    none = 0,
    //% block="clockwise"
    clockwise = 1,
    //% block="counter-clockwise"
    counterclockwise = 2,
    //% block="180-degree"
    one_eighty_degree = 3,
}

enum on_off{
    //% block="on"
    _on=1,
    //% block="off"
    _off=0,

}

enum selectColor{
	//% block="_yellow"
	_yellow=0,
	//% block="_red"
	_red=1,
	//% block="_green"
	_green=2,
}


//% color="#794044" weight=10 icon="\uf108" block="monitors"
namespace monitors{
	

    
    /**
     * LED
     */
    
    //% blockId=setled block="set led ：%lpin|status %lstatus" blockExternalInputs=false  group="LED灯"
    //% weight=70
    export function setled(lpin: DigitalPin,lstatus: on_off): void {
        pins.digitalWritePin(lpin,lstatus)
    }






	
	
	
	


        
    /**
     * MAX7219  
     */
	const _NOOP = 0 // no-op (do nothing, doesn't change current status)
	const _DIGIT = [1, 2, 3, 4, 5, 6, 7, 8] // digit (LED column)
	const _DECODEMODE = 9 // decode mode (1=on, 0-off  for 7-segment display on MAX7219, no usage here)
	const _INTENSITY = 10 // intensity (LED brightness level, 0-15)
	const _SCANLIMIT = 11 // scan limit (number of scanned digits)
	const _SHUTDOWN = 12 // turn on (1) or off (0)
	const _DISPLAYTEST = 15 // force all LEDs light up, no usage here

	let _pinCS = DigitalPin.P16 // LOAD pin, 0=ready to receive command, 1=command take effect
	let _matrixNum = 1 // number of MAX7219 matrix linked in the chain
	let _displayArray: number[] = [] // display array to show accross all matrixs
	let _rotation = 0 // rotate matrixs display for 4-in-1 modules
	let _reversed = false // reverse matrixs display order for 4-in-1 modules
	
	/**
    * Setup/reset MAX7219s. If you are using 4-in-1 module you'll need to set rotation as true. If your chain are consisted of single modules set it as false (default).
    */
    //% block="Setup MAX7219:|Number of matrixs $num|CS(LOAD) = $cs|MOSI(DIN) = $mosi|MISO(not used) = $miso|SCK(CLK) = $sck"
    //% num.min=1 num.defl=1 cs.defl=DigitalPin.P16 mosi.defl=DigitalPin.P15 miso.defl=DigitalPin.P14 sck.defl=DigitalPin.P13 rotate.defl=false group="8X8点阵屏"
    export function setup(num: number, cs: DigitalPin, mosi: DigitalPin, miso: DigitalPin, sck: DigitalPin) {
        // set internal variables        
        _pinCS = cs
        _matrixNum = num
        // prepare display array (for displaying texts  add extra 8 columns at each side as buffers)
        for (let i = 0; i < (num + 2) * 8; i++)  _displayArray.push(0)
        // set micro:bit SPI
        pins.spiPins(mosi, miso, sck)
        pins.spiFormat(8, 3)
        pins.spiFrequency(1000000)
        // initialize MAX7219s
        _registerAll(_SHUTDOWN, 0) // turn off
        _registerAll(_DISPLAYTEST, 0) // test mode off
        _registerAll(_DECODEMODE, 0) // decode mode off
        _registerAll(_SCANLIMIT, 7) // set scan limit to 7 (column 0-7)
        _registerAll(_INTENSITY, 15) // set brightness to 15
        _registerAll(_SHUTDOWN, 1) // turn on
        clearAll() // clear screen on all MAX7219s
    }

    /**
    * Rotation/reverse order options for 4-in-1 MAX7219 modules
    */
    //% block="Rotate matrix display $rotation|Reverse printing order $reversed" rotation.defl=rotation_direction.none group="8X8点阵屏" blockExternalInputs=true advanced=true
    export function for_4_in_1_modules(rotation: rotation_direction, reversed: boolean) {
        _rotation = rotation
        _reversed = reversed
    }

    /**
    * (internal function) write command and data to all MAX7219s
    */
    function _registerAll(addressCode: number, data: number) {
        pins.digitalWritePin(_pinCS, 0) // LOAD=LOW, start to receive commands
        for (let i = 0; i < _matrixNum; i++) {
            // when a MAX7219 received a new command/data set
            // the previous one would be pushed to the next matrix along the chain via DOUT
            pins.spiWrite(addressCode) // command (8 bits)
            pins.spiWrite(data) //data (8 bits)
        }
        pins.digitalWritePin(_pinCS, 1) // LOAD=HIGH, commands take effect
    }

    /**
    * (internal function) write command and data to a specific MAX7219 (index 0=farthest on the chain)
    */
    function _registerForOne(addressCode: number, data: number, matrixIndex: number) {
        if (matrixIndex <= _matrixNum - 1) {
            pins.digitalWritePin(_pinCS, 0) // LOAD=LOW, start to receive commands
            for (let i = 0; i < _matrixNum; i++) {
                // when a MAX7219 received a new command/data set
                // the previous one would be pushed to the next matrix along the chain via DOUT
                if (i == matrixIndex) { // send change to target
                    pins.spiWrite(addressCode) // command (8 bits)
                    pins.spiWrite(data) //data (8 bits)
                } else { // do nothing to non-targets
                    pins.spiWrite(_NOOP)
                    pins.spiWrite(0)
                }
            }
            pins.digitalWritePin(_pinCS, 1) // LOAD=HIGH, commands take effect
        }
    }

    /**
    * (internal function) rotate matrix
    */
    function _rotateMatrix(matrix: number[][]): number[][] {
        let tmp = 0
        for (let i = 0; i < 4; i++) {
            for (let j = i; j < 7 - i; j++) {
                tmp = matrix[i][j]
                if (_rotation == rotation_direction.clockwise) { // clockwise
                    matrix[i][j] = matrix[j][7 - i]
                    matrix[j][7 - i] = matrix[7 - i][7 - j]
                    matrix[7 - i][7 - j] = matrix[7 - j][i]
                    matrix[7 - j][i] = tmp
                } else if (_rotation == rotation_direction.counterclockwise) { // counter-clockwise
                    matrix[i][j] = matrix[7 - j][i]
                    matrix[7 - j][i] = matrix[7 - i][7 - j]
                    matrix[7 - i][7 - j] = matrix[j][7 - i]
                    matrix[j][7 - i] = tmp
                } else if (_rotation == rotation_direction.one_eighty_degree) { // 180 degree
                    matrix[i][j] = matrix[7 - i][7 - j]
                    matrix[7 - i][7 - j] = tmp
                    tmp = matrix[7 - j][i]
                    matrix[7 - j][i] = matrix[j][7 - i]
                    matrix[j][7 - i] = tmp
                }
            }
        }
        return matrix
    }

    /**
    * (internal function) get 8x8 matrix from a column array
    */
    function _getMatrixFromColumns(columns: number[]): number[][] {
        let matrix: number[][] = getEmptyMatrix()
        for (let i = 0 ; i < 8 ; i++) {
            for (let j = 7; j >= 0;j--) {
                if (columns[i] >= 2 ** j) {
                    columns[i] -= 2 ** j
                    matrix[i][j] = 1
                } else if (columns[i] == 0) {
                    break
                }
            }
        }
        return matrix
    }

    /**
    * Scroll a text accross all MAX7219 matrixs for once
    */
    //% block="Scroll text $text|delay (ms) $delay|at the end wait (ms) $endDelay" text.defl="Hello world!" delay.min=0 delay.defl=75 endDelay.min=0 endDelay.defl=500 group="8X8点阵屏" blockExternalInputs=true
    export function scrollText(text: string, delay: number, endDelay: number) {
        let printPosition = _displayArray.length - 8
        let characters_index: number[] = []
        let currentChrIndex = 0
        let currentFontArray: number[] = []
        let nextChrCountdown = 1
        let chrCountdown: number[] = []
        let totalScrollTime = 0
        // clear screen and array
        for (let i = 0; i < _displayArray.length;  i++) _displayArray[i] = 0
        clearAll()
        // get font index of every characters and total scroll time needed
        for (let i = 0; i < text.length; i++) {
            let index = font.indexOf(text.substr(i, 1))
            if (index >= 0) {
                characters_index.push(index)
                chrCountdown.push(font_matrix[index].length)
                totalScrollTime += font_matrix[index].length
            }
        }
        totalScrollTime += _matrixNum * 8
        // print characters into array and scroll the array
        for (let i = 0; i < totalScrollTime; i++) {
            nextChrCountdown -= 1
            if (currentChrIndex < characters_index.length && nextChrCountdown == 0) {
                // print a character just "outside" visible area
                currentFontArray = font_matrix[characters_index[currentChrIndex]]
                if (currentFontArray != null)
                    for (let j = 0; j < currentFontArray.length; j++)
                        _displayArray[printPosition + j] = currentFontArray[j]
                // wait until current character scrolled into visible area
                nextChrCountdown = chrCountdown[currentChrIndex]
                currentChrIndex += 1
            }
            // scroll array (copy all columns to the one before it)
            for (let j = 0; j < _displayArray.length - 1;  j++) {
                _displayArray[j] = _displayArray[j + 1]
            }
            _displayArray[_displayArray.length - 1] = 0
            // write every 8 columns of display array (visible area) to each MAX7219s
            let matrixCountdown = _matrixNum - 1
            let actualMatrixIndex = 0
            for (let j = 8; j < _displayArray.length - 8; j += 8) {
                if (matrixCountdown < 0) break
                if (!_reversed) actualMatrixIndex = matrixCountdown
                else actualMatrixIndex = _matrixNum - 1 - matrixCountdown
                if (_rotation == rotation_direction.none) {
                    for (let k = j; k < j + 8; k++)
                        _registerForOne(_DIGIT[k - j], _displayArray[k], actualMatrixIndex)
                } else { // rotate matrix if needed
                    let tmpColumns = [0, 0, 0, 0, 0, 0, 0, 0]
                    let l = 0
                    for (let k = j; k <j + 8; k++) tmpColumns[l++] = _displayArray[k]
                    displayLEDsForOne(_getMatrixFromColumns(tmpColumns), actualMatrixIndex)
                }
                matrixCountdown--
            }
            basic.pause(delay)
        }
        basic.pause(endDelay)
    }

    /**
    * Print a text accross the chain of MAX7219 matrixs at a specific spot. Offset value -8 ~ last column of matrixs. You can choose to clear the screen or not (if not it can be used to print multiple string on the MAX7219 chain).
    */
    //% block="Display text $text|offset $offset|clear screen first $clear" text.defl="Hi!" offset.min=-8 clear.defl=true group="8X8点阵屏" blockExternalInputs=true advanced=true
    export function displayText(text: string, offset: number, clear: boolean) {
        // clear screen and array if needed
        if (clear) {
            for (let i = 0; i < _displayArray.length; i++) _displayArray[i] = 0
            clearAll()
        }
        let printPosition = Math.constrain(offset, -8, _displayArray.length - 9) + 8
        let currentPosition = printPosition
        let characters_index: number[] = []
        let currentChrIndex = 0
        let currentFontArray: number[] = []
        // get font index of every characters
        for (let i = 0; i < text.length; i++) {
            let index = font.indexOf(text.substr(i, 1))
            if (index >= 0) characters_index.push(index)
        }
        // print characters into array from offset position
        while (currentPosition < _displayArray.length - 8) {
            currentFontArray = font_matrix[characters_index[currentChrIndex]]
            if (currentFontArray != null)
                for (let j = 0; j < currentFontArray.length; j++)
                    _displayArray[printPosition++] = currentFontArray[j]
            currentChrIndex += 1
            if (currentChrIndex == characters_index.length) break
        }
        // write every 8 columns of display array (visible area) to each MAX7219s
        let matrixCountdown = _matrixNum - 1
        let actualMatrixIndex = 0
        for (let i = 8; i < _displayArray.length - 8; i += 8) {
            if (matrixCountdown < 0) break
            if (!_reversed) actualMatrixIndex = matrixCountdown
            else actualMatrixIndex = _matrixNum - 1 - matrixCountdown
            if (_rotation == rotation_direction.none) {
                for (let j = i ; j < i + 8 ; j++)
                    _registerForOne(_DIGIT[j - i], _displayArray[j], actualMatrixIndex)
            } else { // rotate matrix and reverse order if needed
                let tmpColumns = [0, 0, 0, 0, 0, 0, 0, 0]
                let l = 0
                for (let j = i ; j < i + 8 ; j++)  tmpColumns[l++] = _displayArray[j]
                displayLEDsForOne(_getMatrixFromColumns(tmpColumns), actualMatrixIndex)
            }
            matrixCountdown--
        }
    }

    /**
    * Print a custom character from a number array on the chain of MAX7219 matrixs at a specific spot. Each number in the array is 0-255, the decimal version of column's byte number. Offset value -8 ~ last column of matrixs. You can choose to clear the screen or not (if not it can be used to print multiple string on the MAX7219 chain).
    */
    //% block="Display custom character from|number array $customCharArray|offset $offset|clear screen first $clear" offset.min=-8 clear.defl=true group="8X8点阵屏" blockExternalInputs=true advanced=true
    export function displayCustomCharacter(customCharArray: number[], offset: number, clear: boolean) {
        // clear screen and array if needed
        if (clear) {
            for (let i = 0; i < _displayArray.length;i++) _displayArray[i] = 0
            clearAll()
        }
        let printPosition: number = Math.constrain(offset, -8, _displayArray.length - 9) + 8
        if (customCharArray != null) {
            // print column data to display array
            for (let i = 0; i < customCharArray.length; i++)
                _displayArray[printPosition + i] = customCharArray[i]
            // write every 8 columns of display array (visible area) to each MAX7219s
            let matrixCountdown = _matrixNum - 1
            let actualMatrixIndex = 0
            for (let i = 8; i < _displayArray.length - 8; i += 8) {
                if (matrixCountdown < 0) break
                if (!_reversed) actualMatrixIndex = matrixCountdown
                else actualMatrixIndex = _matrixNum - 1 - matrixCountdown
                if (_rotation == rotation_direction.none) {
                    for (let j = i ; j < i + 8 ; j++)
                        _registerForOne(_DIGIT[j - i], _displayArray[j], actualMatrixIndex)
                } else { // rotate matrix and reverse order if needed
                    let tmpColumns = [0, 0, 0, 0, 0, 0, 0, 0]
                    let l = 0
                    for (let j = i ; j < i + 8 ; j++) tmpColumns[l++] = _displayArray[j]
                    displayLEDsForOne(_getMatrixFromColumns(tmpColumns), actualMatrixIndex)
                }
                matrixCountdown--
            }
        }
    }

    /**
    * Return a number array calculated from a 8x8 LED byte array (example: B00100000,B01000000,B10000110,B10000000,B10000000,B10000110,B01000000,B00100000)
    */
    //% block="Get custom character number array|from byte-array string $text" text.defl="B00100000,B01000000,B10000110,B10000000,B10000000,B10000110,B01000000,B00100000" group="8X8点阵屏" blockExternalInputs=true advanced=true
    export function getCustomCharacterArray(text: string) {
        let tempTextArray: string[] = []
        let resultNumberArray: number[] = []
        let currentIndex = 0
        let currentChr = ""
        let currentNum = 0
        let columnNum = 0
        if (text != null && text.length >= 0) {
            // seperate each byte number to a string
            while (currentIndex < text.length) {
                tempTextArray.push(text.substr(currentIndex + 1, 8))
                currentIndex += 10
            }
            for (let i = 0; i < tempTextArray.length; i++) {
                columnNum = 0
                // read each bit and calculate the decimal sum
                for (let j = tempTextArray[i].length - 1; j >= 0; j--) {
                    currentChr = tempTextArray[i].substr(j, 1)
                    if (currentChr == "1" || currentChr == "0")
                        currentNum = parseInt(currentChr)
                    else
                        currentNum = 0
                    columnNum += (2 ** (tempTextArray[i].length - j - 1)) * currentNum
                }
                // generate new decimal array
                resultNumberArray.push(columnNum)
            }
            return resultNumberArray
        } else {
            return null
        }
    }

    /**
    * Add a custom character from a number array at the end of the extension's font library.
    * Each number in the array is 0-255, the decimal version of column's byte number.
    */
    //% block="Add custom character $chr|number array $customCharArray|to the extension font library"
    //% chr.defl=""
    //% blockExternalInputs=true
    //% group="8X8点阵屏"
    //% advanced=true
    export function addCustomChr(chr: string, customCharArray: number[]) {
        if (chr != null && chr.length == 1 && customCharArray != null) {
            // add new character
            font.push(chr)
            font_matrix.push(customCharArray)
        }
    }

    /**
    * Display all fonts in the extension font library
    */
    //% block="Display all fonts at delay $delay" delay.min=0 delay.defl=200 group="8X8点阵屏" advanced=true
    export function fontDemo(delay: number) {
        let offsetIndex = 0
        clearAll()
        // print all characters on all matrixs
        for (let i = 1; i < font_matrix.length; i++) {
            // print two blank spaces to "reset" a matrix
            displayCustomCharacter(font_matrix[0], offsetIndex * 8, false)
            displayCustomCharacter(font_matrix[0], offsetIndex * 8 + 4, false)
            // print a character
            displayCustomCharacter(font_matrix[i], offsetIndex * 8, false)
            if (offsetIndex == _matrixNum - 1) offsetIndex = 0
            else offsetIndex += 1
            basic.pause(delay)
        }
        basic.pause(delay)
        clearAll()
    }

    /**
    * Turn on or off all MAX7219s
    */
    //% block="Turn on all matrixs $status" status.defl=true group="8X8点阵屏" advanced=true
    export function togglePower(status: boolean) {
        if (status) _registerAll(_SHUTDOWN, 1)
        else _registerAll(_SHUTDOWN, 0)
    }

    /**
    * Set brightness level of LEDs on all MAX7219s
    */
    //% block="Set all brightness level $level" level.min=0 level.max=15 level.defl=15 group="8X8点阵屏"
    export function brightnessAll(level: number) {
        _registerAll(_INTENSITY, level)
    }

    /**
    * Set brightness level of LEDs on a specific MAX7219s (index 0=farthest on the chain)
    */
    //% block="Set brightness level $level on matrix index = $index" level.min=0 level.max=15 level.defl=15 index.min=0 group="8X8点阵屏" advanced=true
    export function brightnessForOne(level: number, index: number) {
        _registerForOne(_INTENSITY, level, index)
    }

    /**
    * Turn on all LEDs on all MAX7219s
    */
    //% block="Fill all LEDs" group="8X8点阵屏"
    export function fillAll() {
        for (let i = 0; i < 8; i++) _registerAll(_DIGIT[i], 255)
    }

    /**
    * Turn on LEDs on a specific MAX7219
    */
    //% block="Fill LEDs on matrix index = $index" index.min=0 group="8X8点阵屏" advanced=true
    export function fillForOne(index: number) {
        for (let i = 0; i < 8; i++) _registerForOne(_DIGIT[i], 255, index)
    }

    /**
    * Turn off LEDs on all MAX7219s
    */
    //% block="Clear all LEDs" group="8X8点阵屏"
    export function clearAll() {
        for (let i = 0 ; i < 8 ; i++) _registerAll(_DIGIT[i], 0)
    }

    /**
    * Turn off LEDs on a specific MAX7219 (index 0=farthest on the chain)
    */
    //% block="Clear LEDs on matrix index = $index" index.min=0 group="8X8点阵屏" advanced=true
    export function clearForOne(index: number) {
        for (let i = 0 ; i < 8 ; i++) _registerForOne(_DIGIT[i], 0, index)
    }

    /**
    * Turn on LEDs randomly on all MAX7219s
    */
    //% block="Randomize all LEDs" index.min=0 group="8X8点阵屏"
    export function randomizeAll() {
        for (let i = 0 ; i < 8 ; i++) _registerAll(_DIGIT[i], Math.randomRange(0, 255))
    }

    /**
    * Turn on LEDs randomly on a specific MAX7219 (index 0=farthest on the chain)
    */
    //% block="Randomize LEDs on matrix index = $index" index.min=0 group="8X8点阵屏" advanced=true
    export function randomizeForOne(index: number) {
        for (let i = 0 ; i < 8 ; i++) _registerForOne(_DIGIT[i], Math.randomRange(0, 255), index)
    }

    /**
    * Set LEDs of all MAX7219s to a pattern from a 8x8 matrix variable (index 0=farthest on the chain)
    */
    //% block="Display 8x8 pattern $newMatrix on all matrixs" group="8X8点阵屏" advanced=true
    export function displayLEDsToAll(newMatrix: number[][]) {
        let columnValue = 0
        if (newMatrix != null) {
            if (_rotation != rotation_direction.none) newMatrix = _rotateMatrix(newMatrix) // rotate matrix if needed
            for (let i = 0 ; i < 8 ; i++) {
                if (newMatrix[i] != null) {
                    columnValue = 0
                    for (let j = 0 ; j < 8 ; j++) {
                        if (newMatrix[i][j]) {
                            // combine row 0-7 status into a byte number (0-255)
                            columnValue += 2 ** j
                        }
                    }
                    _registerAll(_DIGIT[i], columnValue)
                }
            }
        }
    }

    /**
    * Set LEDs of a specific MAX7219s to a pattern from a 8x8 number matrix variable (index 0=farthest on the chain)
    */
    //% block="Display 8x8 pattern $newMatrix|on matrix index = $index" index.min=0 blockExternalInputs=true group="8X8点阵屏" advanced=true
    export function displayLEDsForOne(newMatrix: number[][], index: number) {
        let columnValue = 0
        if (newMatrix != null) {
            if (_rotation != rotation_direction.none) newMatrix = _rotateMatrix(newMatrix) // rotate matrix if needed
            for (let i = 0 ; i < 8 ; i++) {
                if (newMatrix[i] != null) {
                    columnValue = 0
                    for (let j = 0 ; j < 8 ; j++) {
                        if (newMatrix[i][j]) {
                            // combine row 0-7 status into a byte number (0-255)
                            columnValue += 2 ** j
                        }
                    }
                    _registerForOne(_DIGIT[i], columnValue, index)
                }
            }
        }
    }

    /**
    * Return a empty 8x8 number matrix variable
    */
    //% block="Empty 8x8 pattern" group="8X8点阵屏" advanced=true
    export function getEmptyMatrix() {
        return [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0],
        ]
    }

    /**
    * Return a full 8x8 number matrix variable
    */
    //% block="Full 8x8 pattern" group="8X8点阵屏" advanced=true
    export function getFullMatrix() {
        return [
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
        ]
    }

    /**
    * Return a specific value from a 8x8 number matrix variable
    */
    //% block="Get value from 8x8 pattern %matrix|x = $x y = $y" x.min=0 x.max=7 y.min=0 y.max=7 group="8X8点阵屏" blockExternalInputs=true advanced=true
    export function getValueFromMatrix(matrix: number[][], x: number, y: number) {
        return matrix[x][y]
    }

    /**
    * Set a specific value in a 8x8 number matrix variable
    */
    //% block="Set 8x8 pattern %matrix|x = $x y = $y value to $value" value.min=0 value.max=1 x.min=0 x.max=7 y.min=0 y.max=7 group="8X8点阵屏" blockExternalInputs=true advanced=true
    export function setValueInMatrix(matrix: number[][], x: number, y: number, value: number) {
        matrix[x][y] = value
    }

    /**
    * Toggle (between 0/1) a specific value in a 8x8 number matrix variable
    */
    //% block="Toogle value in 8x8 pattern %matrix|x = $x y = $y" x.min=0 x.max=7 y.min=0 y.max=7 group="8X8点阵屏" blockExternalInputs=true advanced=true
    export function toogleValueInMatrix(matrix: number[][], x: number, y: number) {
        if (matrix[x][y] == 1) matrix[x][y] = 0
        else if (matrix[x][y] == 0) matrix[x][y] = 1
    }


    let font = [" ", "!", "\"", "#", "$", "%", "&", "\'", "(", ")",
        "*", "+", ",", "-", ".", "/",
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
        ":", " ", "<", "=", ">", "?", "@",
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
        "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
        "[", "\\", "]", "_", "`",
        "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l",
        "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
        "{", "|", "}", "~", "^"]

    let font_matrix = [
        [0b00000000,
            0b00000000,
            0b00000000,
            0b00000000],
        [0b01011111,
            0b00000000],
        [0b00000011,
            0b00000000,
            0b00000011,
            0b00000000],
        [0b00010100,
            0b00111110,
            0b00010100,
            0b00111110,
            0b00010100,
            0b00000000],
        [0b00100100,
            0b01101010,
            0b00101011,
            0b00010010,
            0b00000000],
        [0b01100011,
            0b00010011,
            0b00001000,
            0b01100100,
            0b01100011,
            0b00000000],
        [0b00110110,
            0b01001001,
            0b01010110,
            0b00100000,
            0b01010000,
            0b00000000],
        [0b00000011,
            0b00000000],
        [0b00011100,
            0b00100010,
            0b01000001,
            0b00000000],
        [0b01000001,
            0b00100010,
            0b00011100,
            0b00000000],
        [0b00101000,
            0b00011000,
            0b00001110,
            0b00011000,
            0b00101000,
            0b00000000],
        [0b00001000,
            0b00001000,
            0b00111110,
            0b00001000,
            0b00001000,
            0b00000000],
        [0b10110000,
            0b01110000,
            0b00000000],
        [0b00001000,
            0b00001000,
            0b00001000],
        [0b01100000,
            0b01100000,
            0b00000000],
        [0b01100000,
            0b00011000,
            0b00000110,
            0b00000001,
            0b00000000],
        [0b00111110,
            0b01000001,
            0b01000001,
            0b00111110,
            0b00000000],
        [0b01000010,
            0b01111111,
            0b01000000,
            0b00000000],
        [0b01100010,
            0b01010001,
            0b01001001,
            0b01000110,
            0b00000000],
        [0b00100010,
            0b01000001,
            0b01001001,
            0b00110110,
            0b00000000],
        [0b00011000,
            0b00010100,
            0b00010010,
            0b01111111,
            0b00000000],
        [0b00100111,
            0b01000101,
            0b01000101,
            0b00111001,
            0b00000000],
        [0b00111110,
            0b01001001,
            0b01001001,
            0b00110000,
            0b00000000],
        [0b01100001,
            0b00010001,
            0b00001001,
            0b00000111,
            0b00000000],
        [0b00110110,
            0b01001001,
            0b01001001,
            0b00110110,
            0b00000000],
        [0b00000110,
            0b01001001,
            0b01001001,
            0b00111110,
            0b00000000],
        [0b00010100,
            0b00000000],
        [0b00100000,
            0b00010100,
            0b00000000],
        [0b00001000,
            0b00010100,
            0b00100010,
            0b00000000],
        [0b00010100,
            0b00010100,
            0b00010100,
            0b00000000],
        [0b00100010,
            0b00010100,
            0b00001000,
            0b00000000],
        [0b00000010,
            0b01011001,
            0b00001001,
            0b00000110,
            0b00000000],
        [0b00111110,
            0b01001001,
            0b01010101,
            0b01011101,
            0b00001110,
            0b00000000],
        [0b01111110,
            0b00010001,
            0b00010001,
            0b01111110,
            0b00000000],
        [0b01111111,
            0b01001001,
            0b01001001,
            0b00110110,
            0b00000000],
        [0b00111110,
            0b01000001,
            0b01000001,
            0b00100010,
            0b00000000],
        [0b01111111,
            0b01000001,
            0b01000001,
            0b00111110,
            0b00000000],
        [0b01111111,
            0b01001001,
            0b01001001,
            0b01000001,
            0b00000000],
        [0b01111111,
            0b00001001,
            0b00001001,
            0b00000001,
            0b00000000],
        [0b00111110,
            0b01000001,
            0b01001001,
            0b01111010,
            0b00000000],
        [0b01111111,
            0b00001000,
            0b00001000,
            0b01111111,
            0b00000000],
        [0b01000001,
            0b01111111,
            0b01000001,
            0b00000000],
        [0b00110000,
            0b01000000,
            0b01000001,
            0b00111111,
            0b00000000],
        [0b01111111,
            0b00001000,
            0b00010100,
            0b01100011,
            0b00000000],
        [0b01111111,
            0b01000000,
            0b01000000,
            0b01000000,
            0b00000000],
        [0b01111111,
            0b00000010,
            0b00001100,
            0b00000010,
            0b01111111,
            0b00000000],
        [0b01111111,
            0b00000100,
            0b00001000,
            0b00010000,
            0b01111111,
            0b00000000],
        [0b00111110,
            0b01000001,
            0b01000001,
            0b00111110,
            0b00000000],
        [0b01111111,
            0b00001001,
            0b00001001,
            0b00000110,
            0b00000000],
        [0b00111110,
            0b01000001,
            0b01000001,
            0b10111110,
            0b00000000],
        [0b01111111,
            0b00001001,
            0b00001001,
            0b01110110,
            0b00000000],
        [0b01000110,
            0b01001001,
            0b01001001,
            0b00110010,
            0b00000000],
        [0b00000001,
            0b00000001,
            0b01111111,
            0b00000001,
            0b00000001,
            0b00000000],
        [0b00111111,
            0b01000000,
            0b01000000,
            0b00111111,
            0b00000000],
        [0b00001111,
            0b00110000,
            0b01000000,
            0b00110000,
            0b00001111,
            0b00000000],
        [0b00111111,
            0b01000000,
            0b00111000,
            0b01000000,
            0b00111111,
            0b00000000],
        [0b01100011,
            0b00010100,
            0b00001000,
            0b00010100,
            0b01100011,
            0b00000000],
        [0b00000111,
            0b00001000,
            0b01110000,
            0b00001000,
            0b00000111,
            0b00000000],
        [0b01100001,
            0b01010001,
            0b01001001,
            0b01000111,
            0b00000000],
        [0b01111111,
            0b01000001,
            0b00000000],
        [0b00000001,
            0b00000110,
            0b00011000,
            0b01100000,
            0b00000000],
        [0b01000001,
            0b01111111,
            0b00000000],
        [0b01000000,
            0b01000000,
            0b01000000,
            0b01000000,
            0b00000000],
        [0b00000001,
            0b00000010,
            0b00000000],
        [0b00100000,
            0b01010100,
            0b01010100,
            0b01111000,
            0b00000000],
        [0b01111111,
            0b01000100,
            0b01000100,
            0b00111000,
            0b00000000],
        [0b00111000,
            0b01000100,
            0b01000100,
            0b00101000,
            0b00000000],
        [0b00111000,
            0b01000100,
            0b01000100,
            0b01111111,
            0b00000000],
        [0b00111000,
            0b01010100,
            0b01010100,
            0b00011000,
            0b00000000],
        [0b00000100,
            0b01111110,
            0b00000101,
            0b00000000],
        [0b10011000,
            0b10100100,
            0b10100100,
            0b01111000,
            0b00000000],
        [0b01111111,
            0b00000100,
            0b00000100,
            0b01111000,
            0b00000000],
        [0b01000100,
            0b01111101,
            0b01000000,
            0b00000000],
        [0b01000000,
            0b10000000,
            0b10000100,
            0b01111101,
            0b00000000],
        [0b01111111,
            0b00010000,
            0b00101000,
            0b01000100,
            0b00000000],
        [0b01000001,
            0b01111111,
            0b01000000,
            0b00000000],
        [0b01111100,
            0b00000100,
            0b01111100,
            0b00000100,
            0b01111000,
            0b00000000],
        [0b01111100,
            0b00000100,
            0b00000100,
            0b01111000,
            0b00000000],
        [0b00111000,
            0b01000100,
            0b01000100,
            0b00111000,
            0b00000000],
        [0b11111100,
            0b00100100,
            0b00100100,
            0b00011000,
            0b00000000],
        [0b00011000,
            0b00100100,
            0b00100100,
            0b11111100,
            0b00000000],
        [0b01111100,
            0b00001000,
            0b00000100,
            0b00000100,
            0b00000000],
        [0b01001000,
            0b01010100,
            0b01010100,
            0b00100100,
            0b00000000],
        [0b00000100,
            0b00111111,
            0b01000100,
            0b00000000],
        [0b00111100,
            0b01000000,
            0b01000000,
            0b01111100,
            0b00000000],
        [0b00011100,
            0b00100000,
            0b01000000,
            0b00100000,
            0b00011100,
            0b00000000],
        [0b00111100,
            0b01000000,
            0b00111100,
            0b01000000,
            0b00111100,
            0b00000000],
        [0b01000100,
            0b00101000,
            0b00010000,
            0b00101000,
            0b01000100,
            0b00000000],
        [0b10011100,
            0b10100000,
            0b10100000,
            0b01111100,
            0b00000000],
        [0b01100100,
            0b01010100,
            0b01001100,
            0b00000000],
        [0b00001000,
            0b00110110,
            0b01000001,
            0b00000000],
        [0b01111111,
            0b00000000],
        [0b01000001,
            0b00110110,
            0b00001000,
            0b00000000],
        [0b00001000,
            0b00000100,
            0b00001000,
            0b00000100,
            0b00000000],
        [0b00000010,
            0b00000001,
            0b00000010,
            0b00000000]]
    









        
        /**
         * TM1650
         */
        let COMMAND_I2C_ADDRESS = 0x24
        let DISPLAY_I2C_ADDRESS = 0x34
        let _SEG = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71] 
    
        let _intensity = 3
        let dbuf = [0, 0, 0, 0]
    
        /**
         * send command to display
         * @param is command, eg: 0
         */
        function cmd(c: number) {
            pins.i2cWriteNumber(COMMAND_I2C_ADDRESS, c, NumberFormat.Int8BE)
        }
    
        /**
         * send data to display
         * @param is data, eg: 0
         */
        function dat(bit: number, d: number) {
            pins.i2cWriteNumber(DISPLAY_I2C_ADDRESS + (bit % 4), d, NumberFormat.Int8BE)
        }
    
        /**
         * turn on display
         */
        //% blockId="TM650_ON" block="turn on display" group="1650数码管"
        //% weight=50 blockGap=8
        export function on() {
            cmd(_intensity * 16 + 1)
        }
    
        /**
         * turn off display
         */
        //% blockId="TM650_OFF" block="turn off display" group="1650数码管"
        //% weight=50 blockGap=8
        export function off() {
            _intensity = 0
            cmd(0)
        }
    
        /**
         * clear display content
         */
        //% blockId="TM650_CLEAR" block="clear display" group="1650数码管"
        //% weight=40 blockGap=8
        export function clear() {
            dat(0, 0)
            dat(1, 0)
            dat(2, 0)
            dat(3, 0)
            dbuf = [0, 0, 0, 0]
        }
    
        /**
         * show a digital in given position
         * @param digit is number (0-15) will be shown, eg: 1
         * @param bit is position, eg: 0
         */
        //% blockId="TM650_DIGIT" block="show digit %num|at %bit" advanced=true  group="1650数码管"
        //% weight=80 blockGap=8
        //% num.max=15 num.min=0
        export function digit(num: number, bit: number) {
            dbuf[bit % 4] = _SEG[num % 16]
            dat(bit, _SEG[num % 16])
        }
    
        /**
         * show a number in display
         * @param num is number will be shown, eg: 100
         */
        //% blockId="TM650_SHOW_NUMBER" block="show number %num"  group="1650数码管"
        //% weight=100 blockGap=8
        export function showNumber(num: number) {
            if (num < 0) {
                dat(0, 0x40) // '-'
                num = -num
            }
            else
                digit(Math.idiv(num, 1000) % 10, 0)
            digit(num % 10, 3)
            digit(Math.idiv(num, 10) % 10, 2)
            digit(Math.idiv(num, 100) % 10, 1)
        }
    
        /**
         * show a number in hex format
         * @param num is number will be shown, eg: 123
         */
        //% blockId="TM650_SHOW_HEX_NUMBER" block="show hex number %num" advanced=true  group="1650数码管"
        //% weight=90 blockGap=8
        export function showHex(num: number) {
            if (num < 0) {
                dat(0, 0x40) // '-'
                num = -num
            }
            else
                digit((num >> 12) % 16, 0)
            digit(num % 16, 3)
            digit((num >> 4) % 16, 2)
            digit((num >> 8) % 16, 1)
        }
    
        /**
         * show Dot Point in given position
         * @param bit is positiion, eg: 0
         * @param show is true/false, eg: true
         */
        //% blockId="TM650_SHOW_DP" block="show dot point %bit|show %num" advanced=true  group="1650数码管"
        //% weight=80 blockGap=8
        export function showDpAt(bit: number, show: boolean) {
            if (show) dat(bit, dbuf[bit % 4] | 0x80)
            else dat(bit, dbuf[bit % 4] & 0x7F)
        }
    
        /**
         * set display intensity
         * @param dat is intensity of the display, eg: 3
         */
        //% blockId="TM650_INTENSITY" block="set intensity %dat"   group="1650数码管"
        //% weight=70 blockGap=8
        export function setIntensity(dat: number) {
            if ((dat < 0) || (dat > 8))
                return 
            if (dat == 0)
                off()
            else {
                _intensity = dat
                cmd((dat << 4) | 0x01)
            }
        }
    
        on() 
            









        
        /**
         * TM1637
         */
        let TM1637_CMD1 = 0x40
        let TM1637_CMD2 = 0xC0
        let TM1637_CMD3 = 0x80
        let _SEGMENTS = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x77, 0x7C, 0x39, 0x5E, 0x79, 0x71]
    
        /**
         * TM1637 LED display
         */
        export class TM1637LEDs {
            buf: Buffer
            clk: DigitalPin
            dio: DigitalPin
            _ON: number
            brightness: number
            count: number   // number of LEDs
    
            /**
             * initial TM1637
             */
            init(): void {
                pins.digitalWritePin(this.clk, 0)
                pins.digitalWritePin(this.dio, 0)
                this._ON = 8
                this.buf = pins.createBuffer(this.count)
                this.clear()
            }
    
            /**
             * Start 
             */
            _start() {
                pins.digitalWritePin(this.dio, 0)
                pins.digitalWritePin(this.clk, 0)
            }
    
            /**
             * Stop
             */
            _stop() {
                pins.digitalWritePin(this.dio, 0)
                pins.digitalWritePin(this.clk, 1)
                pins.digitalWritePin(this.dio, 1)
            }
    
            /**
             * send command1
             */
            _write_data_cmd() {
                this._start()
                this._write_byte(TM1637_CMD1)
                this._stop()
            }
    
            /**
             * send command3
             */
            _write_dsp_ctrl() {
                this._start()
                this._write_byte(TM1637_CMD3 | this._ON | this.brightness)
                this._stop()
            }
    
            /**
             * send a byte to 2-wire interface
             */
            _write_byte(b: number) {
                for (let i = 0; i < 8; i++) {
                    pins.digitalWritePin(this.dio, (b >> i) & 1)
                    pins.digitalWritePin(this.clk, 1)
                    pins.digitalWritePin(this.clk, 0)
                }
                pins.digitalWritePin(this.clk, 1)
                pins.digitalWritePin(this.clk, 0)
            }
    
            /**
             * set TM1637 intensity, range is [0-8], 0 is off.
             * @param val the brightness of the TM1637, eg: 7
             */
            //% blockId="TM1637_set_intensity" block="%tm|set intensity %val"  group="1637数码管"
            //% weight=50 blockGap=8
            //% parts="TM1637"
            intensity(val: number = 7) {
                if (val < 1) {
                    this.off()
                    return
                }
                if (val > 8) val = 8 
                this._ON = 8
                this.brightness = val - 1
                this._write_data_cmd()
                this._write_dsp_ctrl()
            }
    
            /**
             * set data to TM1637, with given bit
             */
            _dat(bit: number, dat: number) {
                this._write_data_cmd()
                this._start()
                this._write_byte(TM1637_CMD2 | (bit % this.count))
                this._write_byte(dat)
                this._stop()
                this._write_dsp_ctrl()
            }
    
            /**
             * show a number in given position. 
             * @param num number will show, eg: 5
             * @param bit the position of the LED, eg: 0
             */
            //% blockId="TM1637_showbit" block="%tm|show digit %num |at %bit" advanced=true  group="1637数码管"
            //% weight=90 blockGap=8
            //% parts="TM1637"
            showbit(num: number = 5, bit: number = 0) {
                this.buf[bit % this.count] = _SEGMENTS[num % 16]
                this._dat(bit, _SEGMENTS[num % 16])
            }
    
            /**
              * show a number. 
              * @param num is a number, eg: 0
              */
            //% blockId="TM1637_shownum" block="%tm|show number %num"  group="1637数码管"
            //% weight=91 blockGap=8
            //% parts="TM1637"
            showNumber(num: number) {
                if (num < 0) {
                    this._dat(0, 0x40) // '-'
                    num = -num
                }
                else
                    this.showbit((num / 1000) % 10)
                this.showbit(num % 10, 3)
                this.showbit((num / 10) % 10, 2)
                this.showbit((num / 100) % 10, 1)
            }
    
            /**
              * show a hex number. 
              * @param num is a hex number, eg: 0
              */
            //% blockId="TM1637_showhex" block="%tm|show hex number %num" advanced=true  group="1637数码管"
            //% weight=90 blockGap=8
            //% parts="TM1637"
            showHex(num: number) {
                if (num < 0) {
                    this._dat(0, 0x40) // '-'
                    num = -num
                }
                else
                    this.showbit((num >> 12) % 16)
                this.showbit(num % 16, 3)
                this.showbit((num >> 4) % 16, 2)
                this.showbit((num >> 8) % 16, 1)
            }
    
            /**
             * show or hide dot point. 
             * @param bit is the position, eg: 1
             * @param show is show/hide dp, eg: true
             */
            //% blockId="TM1637_showDP" block="%tm|DotPoint at %bit|show %show" advanced=true  group="1637数码管"
            //% weight=70 blockGap=8
            //% parts="TM1637"
            showDP(bit: number = 1, show: boolean = true) {
                bit = bit % this.count
                if (show) this._dat(bit, this.buf[bit] | 0x80)
                else this._dat(bit, this.buf[bit] & 0x7F)
            }
    
            /**
             * clear LED. 
             */
            //% blockId="TM1637_clear" block="clear %tm"  group="1637数码管"
            //% weight=80 blockGap=8
            //% parts="TM1637"
            clear() {
                for (let i = 0; i < this.count; i++) {
                    this._dat(i, 0)
                    this.buf[i] = 0
                }
            }
    
            /**
             * turn on LED. 
             */
            //% blockId="TM1637_on" block="turn on %tm"  group="1637数码管"
            //% weight=86 blockGap=8
            //% parts="TM1637"
            on() {
                this._ON = 8
                this._write_data_cmd()
                this._write_dsp_ctrl()
            }
    
            /**
             * turn off LED. 
             */
            //% blockId="TM1637_off" block="turn off %tm"  group="1637数码管"
            //% weight=85 blockGap=8
            //% parts="TM1637"
            off() {
                this._ON = 0
                this._write_data_cmd()
                this._write_dsp_ctrl()
            }
        }
    
        /**
         * create a TM1637 object.
         * @param clk the CLK pin for TM1637, eg: DigitalPin.P1
         * @param dio the DIO pin for TM1637, eg: DigitalPin.P2
         * @param intensity the brightness of the LED, eg: 7
         * @param count the count of the LED, eg: 4
         */
        //% weight=200 blockGap=8
        //% blockId="TM1637_create" block="CLK %clk|DIO %dio|intensity %intensity|LED count %count"  group="1637数码管"
        export function TMcreate(clk: DigitalPin, dio: DigitalPin, intensity: number, count: number): TM1637LEDs {
            let tm = new TM1637LEDs()
            tm.clk = clk
            tm.dio = dio
            if ((count < 1) || (count > 5)) count = 4
            tm.count = count
            tm.brightness = intensity
            tm.init()
            return tm
        }
                    











	/**
	 *  1602LCD
	 */	
		
	let i2cAddr: number
    let BK: number
    let RS: number

    function setreg(d: number) {
        pins.i2cWriteNumber(i2cAddr, d, NumberFormat.Int8LE)
        basic.pause(1)
    }

    function set(d: number) {
        d = d & 0xF0
        d = d + BK + RS
        setreg(d)
        setreg(d + 4)
        setreg(d)
    }

    function lcdcmd(d: number) {
        RS = 0
        set(d)
        set(d << 4)
    }

    function lcddat(d: number) {
        RS = 1
        set(d)
        set(d << 4)
    }

    //% block="LcdInit $addr" addr.defl="39"  group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdInit(addr: number) {
        i2cAddr = addr
        BK = 8
        RS = 0
        lcdcmd(0x33)
        basic.pause(5)
        set(0x30)
        basic.pause(5)
        set(0x20)
        basic.pause(5)
        lcdcmd(0x28)
        lcdcmd(0x0C)
        lcdcmd(0x06)
        lcdcmd(0x01)
    }

    //% block="showchar $ch|col $x|row $y"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdShowChar(ch: string, x: number, y: number): void {
        let a: number

        if (y > 0)
            a = 0xC0
        else
            a = 0x80
        a += x
        lcdcmd(a)
        lcddat(ch.charCodeAt(0))
    }

    //% block="showNumber $n|col $x|row $y"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdShowNumber(n: number, x: number, y: number): void {
        let s = n.toString()
        i2cLcdShowString(s, x, y)
    }

    /**
     * TODO: describe your function here
     * @param value describe value here, eg: 5
     */
    //% block="showString $s|col $x|row $y"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdShowString(s: string, x: number, y: number): void {
        let a: number

        if (y > 0)
            a = 0xC0
        else
            a = 0x80
        a += x
        lcdcmd(a)

        for (let i = 0; i < s.length; i++) {
            lcddat(s.charCodeAt(i))
        }
    }

    //% block="lcdon"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdOn(): void {
        lcdcmd(0x0C)
    }

    //% block="lcdoff"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdOff(): void {
        lcdcmd(0x08)
    }

    //% block="lcdclear"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdClear(): void {
        lcdcmd(0x01)
    }

    //% block="lcdlighton"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdBacklightOn(): void {
        BK = 8
        lcddat(0)
    }

    //% block="lcdlightoff"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdBacklightOff(): void {
        BK = 0
        lcddat(0)
    }
	












	/*
	 * traffic light
	 */

    let rpins = 0
    let gpins = 0
    let ypins = 0

    //% blockId=setpin block="set light pin|g %GPin|y %YPin|r %RPin" blockExternalInputs=false  group="交通灯"
    //% weight=70
    export function setpin(GPin: DigitalPin, YPin: DigitalPin, RPin: DigitalPin): void {
        gpins= GPin
		ypins = YPin
		rpins= RPin
    }
	
	//% blockId=yledon block="set light pin  %selectpin|light %_status" blockExternalInputs=false  group="交通灯"
    //% weight=70
    export function selectlight(selectpin: selectColor, _status: on_off): void {
        let a;
        if (selectpin == 0)
            a = ypins
        else if (selectpin == 1){ 
            a = rpins 
        }
        else if (selectpin == 2) {
            a = gpins
        }
        pins.digitalWritePin(a, _status)
    }
	
  




    






	/*
	 * RGB light
	 */
 
    
    let _Rpins = 0
    let _Gpins = 0
    let _Bpins = 0

    //% blockId=setrgbpin block="set RGBlight pin|g %_GPin|b %_BPin|r %_RPin" blockExternalInputs=false  group="三色灯"
    //% weight=70
    export function setRGBpin(_GPin: DigitalPin, _BPin: DigitalPin, _RPin: DigitalPin): void {
        _Gpins= _GPin
		_Bpins = _BPin
		_Rpins= _RPin
    }

    //% blockId=blighton block="blue %bstatus" blockExternalInputs=false  group="三色灯"
    //% weight=70
    export function Bluecolor(bstatus: on_off): void {
        pins.digitalWritePin(_Bpins,bstatus)
    }

 
    //% blockId=glighton block="green %gstatus" blockExternalInputs=false  group="三色灯"
    //% weight=70
    export function Greencolor(gstatus: on_off): void {
        pins.digitalWritePin(_Gpins,gstatus)
    }


    //% blockId=rlighton block="red %rstatus" blockExternalInputs=false  group="三色灯"
    //% weight=70
    export function Redcolor(rstatus: on_off): void {
        pins.digitalWritePin(_Rpins,rstatus)
    }




    







 
    
    
}



    







