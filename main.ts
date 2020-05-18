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

//% color="#794044" weight=10 icon="\uf108" block="monitors"
namespace monitors{
    
    
    /**
     * LED
     */
    let ledpin=0

    //% blockId=setled block="set led pin ：%SPin" blockExternalInputs=false  group="LED灯"
    //% weight=70
    export function setled(SPin: DigitalPin): void {
        ledpin = SPin
    }

    //% blockId=ledon block="ledon" blockExternalInputs=false  group="LED灯"
    //% weight=70
    export function ledon(): void {
        pins.digitalWritePin(ledpin,1)
    }

    //% blockId=ledoff block="ledoff" blockExternalInputs=false  group="LED灯"
    //% weight=70
    export function ledoff(): void {
        pins.digitalWritePin(ledpin,0)
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
       *  NeoPixel
       */
    
      enum NeoPixelColors {
        //% block=red
        Red = 0xFF0000,
        //% block=orange
        Orange = 0xFFA500,
        //% block=yellow
        Yellow = 0xFFFF00,
        //% block=green
        Green = 0x00FF00,
        //% block=blue
        Blue = 0x0000FF,
        //% block=indigo
        Indigo = 0x4b0082,
        //% block=violet
        Violet = 0x8a2be2,
        //% block=purple
        Purple = 0xFF00FF,
        //% block=white
        White = 0xFFFFFF,
        //% block=black
        Black = 0x000000
    }
    
    /**
     * Different modes for RGB or RGB+W NeoPixel strips
     */
    enum NeoPixelMode {
        //% block="RGB (GRB format)"
        RGB = 0,
        //% block="RGB+W"
        RGBW = 1,
        //% block="RGB (RGB format)"
        RGB_RGB = 2
    }

        //% shim=sendBufferAsm
        function sendBuffer(buf: Buffer, pin: DigitalPin) {
        }
    
        /**
         * A NeoPixel strip
         */
        export class Strip {
            buf: Buffer;
            pin: DigitalPin;
            // TODO: encode as bytes instead of 32bit
            brightness: number;
            start: number; // start offset in LED strip
            _length: number; // number of LEDs
            _mode: NeoPixelMode;
            _matrixWidth: number; // number of leds in a matrix - if any
            _matrixChain: number; // the connection type of matrix chain
            _matrixRotation: number; // the rotation type of matrix
    
            /**
             * Shows all LEDs to a given color (range 0-255 for r, g, b). 
             * @param rgb RGB color of the LED
             */
            //% blockId="neopixel_set_strip_color" block="%strip|show color %rgb=neopixel_colors"  group="三色环"
            //% weight=85 blockGap=8
            //% parts="neopixel"
            showColor(rgb: number) {
                rgb = rgb >> 0;
                this.setAllRGB(rgb);
                this.show();
            }
    
            /**
             * Shows a rainbow pattern on all LEDs. 
             * @param startHue the start hue value for the rainbow, eg: 1
             * @param endHue the end hue value for the rainbow, eg: 360
             */
            //% blockId="neopixel_set_strip_rainbow" block="%strip|show rainbow from %startHue|to %endHue"  group="三色环"
            //% weight=85 blockGap=8
            //% parts="neopixel"
            showRainbow(startHue: number = 1, endHue: number = 360) {
                if (this._length <= 0) return;
    
                startHue = startHue >> 0;
                endHue = endHue >> 0;
                const saturation = 100;
                const luminance = 50;
                const steps = this._length;
                const direction = HueInterpolationDirection.Clockwise;
    
                //hue
                const h1 = startHue;
                const h2 = endHue;
                const hDistCW = ((h2 + 360) - h1) % 360;
                const hStepCW = Math.idiv((hDistCW * 100), steps);
                const hDistCCW = ((h1 + 360) - h2) % 360;
                const hStepCCW = Math.idiv(-(hDistCCW * 100), steps);
                let hStep: number;
                if (direction === HueInterpolationDirection.Clockwise) {
                    hStep = hStepCW;
                } else if (direction === HueInterpolationDirection.CounterClockwise) {
                    hStep = hStepCCW;
                } else {
                    hStep = hDistCW < hDistCCW ? hStepCW : hStepCCW;
                }
                const h1_100 = h1 * 100; //we multiply by 100 so we keep more accurate results while doing interpolation
    
                //sat
                const s1 = saturation;
                const s2 = saturation;
                const sDist = s2 - s1;
                const sStep = Math.idiv(sDist, steps);
                const s1_100 = s1 * 100;
    
                //lum
                const l1 = luminance;
                const l2 = luminance;
                const lDist = l2 - l1;
                const lStep = Math.idiv(lDist, steps);
                const l1_100 = l1 * 100
    
                //interpolate
                if (steps === 1) {
                    this.setPixelColor(0, hsl(h1 + hStep, s1 + sStep, l1 + lStep))
                } else {
                    this.setPixelColor(0, hsl(startHue, saturation, luminance));
                    for (let i = 1; i < steps - 1; i++) {
                        const h = Math.idiv((h1_100 + i * hStep), 100) + 360;
                        const s = Math.idiv((s1_100 + i * sStep), 100);
                        const l = Math.idiv((l1_100 + i * lStep), 100);
                        this.setPixelColor(i, hsl(h, s, l));
                    }
                    this.setPixelColor(steps - 1, hsl(endHue, saturation, luminance));
                }
                this.show();
            }
    
            /**
             * Displays a vertical bar graph based on the `value` and `high` value.
             * If `high` is 0, the chart gets adjusted automatically.
             * @param value current value to plot
             * @param high maximum value, eg: 255
             */
            //% weight=84
            //% blockId=neopixel_show_bar_graph block="%strip|show bar graph of %value|up to %high"  group="三色环"
            //% icon="\uf080"
            //% parts="neopixel"
            showBarGraph(value: number, high: number): void {
                if (high <= 0) {
                    this.clear();
                    this.setPixelColor(0, NeoPixelColors.Yellow);
                    this.show();
                    return;
                }
    
                value = Math.abs(value);
                const n = this._length;
                const n1 = n - 1;
                let v = Math.idiv((value * n), high);
                if (v == 0) {
                    this.setPixelColor(0, 0x666600);
                    for (let i = 1; i < n; ++i)
                        this.setPixelColor(i, 0);
                } else {
                    for (let i = 0; i < n; ++i) {
                        if (i <= v) {
                            const b = Math.idiv(i * 255, n1);
                            this.setPixelColor(i, rgb(b, 0, 255 - b));
                        }
                        else this.setPixelColor(i, 0);
                    }
                }
                this.show();
            }
    
            /**
             * Set LED to a given color (range 0-255 for r, g, b). 
             * You need to call ``show`` to make the changes visible.
             * @param pixeloffset position of the NeoPixel in the strip
             * @param rgb RGB color of the LED
             */
            //% blockId="neopixel_set_pixel_color" block="%strip|set pixel color at %pixeloffset|to %rgb=neopixel_colors" 
            //% blockGap=8
            //% weight=80
            //% parts="neopixel" advanced=true  group="三色环"
            setPixelColor(pixeloffset: number, rgb: number): void {
                this.setPixelRGB(pixeloffset >> 0, rgb >> 0);
            }
    
            /**
             * Sets the number of pixels in a matrix shaped strip
             * @param width number of pixels in a row
         * @param rotation type of matrix
         * @param chain type of matrix
             */
            //% blockId=neopixel_set_matrix_width block="%strip|set matrix width %width|rotation %rotation|chain %chain"
            //% blockGap=8
            //% weight=5
            //% parts="neopixel" advanced=true  group="三色环"
            setMatrixWidth(width: number, rotation: number, chain: number) {
                this._matrixWidth = Math.min(this._length, width >> 0);
                this._matrixRotation = rotation >> 0;
                this._matrixChain = chain >> 0;
            }
    
            /**
             * Set LED to a given color (range 0-255 for r, g, b) in a matrix shaped strip 
             * You need to call ``show`` to make the changes visible.
             * @param x horizontal position
             * @param y horizontal position
             * @param rgb RGB color of the LED
             */
            //% blockId="neopixel_set_matrix_color" block="%strip|set matrix color at x %x|y %y|to %rgb=neopixel_colors" 
            //% weight=4
            //% parts="neopixel" advanced=true  group="三色环"
            setMatrixColor(x: number, y: number, rgb: number) {
                if (this._matrixWidth <= 0) return; // not a matrix, ignore
                x = x >> 0;
                y = y >> 0;
                rgb = rgb >> 0;
                const cols = Math.idiv(this._length, this._matrixWidth);
    
                if (this._matrixRotation == 1) {
                    let t = y;
                    y = x;
                    x = t;
                } else if (this._matrixRotation == 2) {
                    x = this._matrixWidth - x - 1;
                }
    
    
                // here be the physical mapping
                if (this._matrixChain == 1 && y % 2 == 1) {
                    x = this._matrixWidth - x - 1;
                }
                if (x < 0 || x >= this._matrixWidth || y < 0 || y >= cols) return;
    
                let i = x + y * this._matrixWidth;
                this.setPixelColor(i, rgb);
            }
    
            /**
             * For NeoPixels with RGB+W LEDs, set the white LED brightness. This only works for RGB+W NeoPixels.
             * @param pixeloffset position of the LED in the strip
             * @param white brightness of the white LED
             */
            //% blockId="neopixel_set_pixel_white" block="%strip|set pixel white LED at %pixeloffset|to %white" 
            //% blockGap=8
            //% weight=80
            //% parts="neopixel" advanced=true  group="三色环"
            setPixelWhiteLED(pixeloffset: number, white: number): void {
                if (this._mode === NeoPixelMode.RGBW) {
                    this.setPixelW(pixeloffset >> 0, white >> 0);
                }
            }
    
    
            /**
             * Send all the changes to the strip.
             */
            //% blockId="neopixel_show" block="%strip|show" blockGap=8
            //% weight=79
            //% parts="neopixel"
            show() {
                sendBuffer(this.buf, this.pin);
            }
    
            /**
             * Turn off all LEDs.
             * You need to call ``show`` to make the changes visible.
             */
            //% blockId="neopixel_clear" block="%strip|clear"
            //% weight=76
            //% parts="neopixel"  group="三色环"
            clear(): void {
                const stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
                this.buf.fill(0, this.start * stride, this._length * stride);
            }
    
            /**
             * Gets the number of pixels declared on the strip
             */
            //% blockId="neopixel_length" block="%strip|length" blockGap=8
            //% weight=60 advanced=true  group="三色环"
            length() {
                return this._length;
            }
    
            /**
             * Set the brightness of the strip. This flag only applies to future operation.
             * @param brightness a measure of LED brightness in 0-255. eg: 255
             */
            //% blockId="neopixel_set_brightness" block="%strip|set brightness %brightness" blockGap=8
            //% weight=59
            //% parts="neopixel" advanced=true  group="三色环"
            setBrightness(brightness: number): void {
                this.brightness = brightness & 0xff;
            }
    
            /**
             * Apply brightness to current colors using a quadratic easing function.
             **/
            //% blockId="neopixel_each_brightness" block="%strip|ease brightness" blockGap=8
            //% weight=58
            //% parts="neopixel" advanced=true  group="三色环"
            easeBrightness(): void {
                const stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
                const br = this.brightness;
                const buf = this.buf;
                const end = this.start + this._length;
                const mid = Math.idiv(this._length, 2);
                for (let i = this.start; i < end; ++i) {
                    const k = i - this.start;
                    const ledoffset = i * stride;
                    const br = k > mid
                        ? Math.idiv(255 * (this._length - 1 - k) * (this._length - 1 - k), (mid * mid))
                        : Math.idiv(255 * k * k, (mid * mid));
                    serial.writeLine(k + ":" + br);
                    const r = (buf[ledoffset + 0] * br) >> 8; buf[ledoffset + 0] = r;
                    const g = (buf[ledoffset + 1] * br) >> 8; buf[ledoffset + 1] = g;
                    const b = (buf[ledoffset + 2] * br) >> 8; buf[ledoffset + 2] = b;
                    if (stride == 4) {
                        const w = (buf[ledoffset + 3] * br) >> 8; buf[ledoffset + 3] = w;
                    }
                }
            }
    
            /** 
             * Create a range of LEDs.
             * @param start offset in the LED strip to start the range
             * @param length number of LEDs in the range. eg: 4
             */
            //% weight=89
            //% blockId="neopixel_range" block="%strip|range from %start|with %length|leds"
            //% parts="neopixel"  group="三色环"
            //% blockSetVariable=range
            range(start: number, length: number): Strip {
                start = start >> 0;
                length = length >> 0;
                let strip = new Strip();
                strip.buf = this.buf;
                strip.pin = this.pin;
                strip.brightness = this.brightness;
                strip.start = this.start + Math.clamp(0, this._length - 1, start);
                strip._length = Math.clamp(0, this._length - (strip.start - this.start), length);
                strip._matrixWidth = 0;
                strip._mode = this._mode;
                return strip;
            }
    
            /**
             * Shift LEDs forward and clear with zeros.
             * You need to call ``show`` to make the changes visible.
             * @param offset number of pixels to shift forward, eg: 1
             */
            //% blockId="neopixel_shift" block="%strip|shift pixels by %offset" blockGap=8
            //% weight=40
            //% parts="neopixel"  group="三色环"
            shift(offset: number = 1): void {
                offset = offset >> 0;
                const stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
                this.buf.shift(-offset * stride, this.start * stride, this._length * stride)
            }
    
            /**
             * Rotate LEDs forward.
             * You need to call ``show`` to make the changes visible.
             * @param offset number of pixels to rotate forward, eg: 1
             */
            //% blockId="neopixel_rotate" block="%strip|rotate pixels by %offset" blockGap=8
            //% weight=39
            //% parts="neopixel"  group="三色环"
            rotate(offset: number = 1): void {
                offset = offset >> 0;
                const stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
                this.buf.rotate(-offset * stride, this.start * stride, this._length * stride)
            }
    
            /**
             * Set the pin where the neopixel is connected, defaults to P0.
             */
            //% weight=10
            //% parts="neopixel" advanced=true  group="三色环"
            setPin(pin: DigitalPin): void {
                this.pin = pin;
                pins.digitalWritePin(this.pin, 0);
                // don't yield to avoid races on initialization
            }
    
            /**
             * Estimates the electrical current (mA) consumed by the current light configuration.
             */
            //% weight=9 blockId=neopixel_power block="%strip|power (mA)"
            //% advanced=true  group="三色环"
            power(): number {
                const stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
                const end = this.start + this._length;
                let p = 0;
                for (let i = this.start; i < end; ++i) {
                    const ledoffset = i * stride;
                    for (let j = 0; j < stride; ++j) {
                        p += this.buf[i + j];
                    }
                }
                return Math.idiv(this.length(), 2) /* 0.5mA per neopixel */
                    + Math.idiv(p * 433, 10000); /* rought approximation */
            }
    
            private setBufferRGB(offset: number, red: number, green: number, blue: number): void {
                if (this._mode === NeoPixelMode.RGB_RGB) {
                    this.buf[offset + 0] = red;
                    this.buf[offset + 1] = green;
                } else {
                    this.buf[offset + 0] = green;
                    this.buf[offset + 1] = red;
                }
                this.buf[offset + 2] = blue;
            }
    
            private setAllRGB(rgb: number) {
                let red = unpackR(rgb);
                let green = unpackG(rgb);
                let blue = unpackB(rgb);
    
                const br = this.brightness;
                if (br < 255) {
                    red = (red * br) >> 8;
                    green = (green * br) >> 8;
                    blue = (blue * br) >> 8;
                }
                const end = this.start + this._length;
                const stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
                for (let i = this.start; i < end; ++i) {
                    this.setBufferRGB(i * stride, red, green, blue)
                }
            }
            private setAllW(white: number) {
                if (this._mode !== NeoPixelMode.RGBW)
                    return;
    
                let br = this.brightness;
                if (br < 255) {
                    white = (white * br) >> 8;
                }
                let buf = this.buf;
                let end = this.start + this._length;
                for (let i = this.start; i < end; ++i) {
                    let ledoffset = i * 4;
                    buf[ledoffset + 3] = white;
                }
            }
            private setPixelRGB(pixeloffset: number, rgb: number): void {
                if (pixeloffset < 0
                    || pixeloffset >= this._length)
                    return;
    
                let stride = this._mode === NeoPixelMode.RGBW ? 4 : 3;
                pixeloffset = (pixeloffset + this.start) * stride;
    
                let red = unpackR(rgb);
                let green = unpackG(rgb);
                let blue = unpackB(rgb);
    
                let br = this.brightness;
                if (br < 255) {
                    red = (red * br) >> 8;
                    green = (green * br) >> 8;
                    blue = (blue * br) >> 8;
                }
                this.setBufferRGB(pixeloffset, red, green, blue)
            }
            private setPixelW(pixeloffset: number, white: number): void {
                if (this._mode !== NeoPixelMode.RGBW)
                    return;
    
                if (pixeloffset < 0
                    || pixeloffset >= this._length)
                    return;
    
                pixeloffset = (pixeloffset + this.start) * 4;
    
                let br = this.brightness;
                if (br < 255) {
                    white = (white * br) >> 8;
                }
                let buf = this.buf;
                buf[pixeloffset + 3] = white;
            }
        }
    
        /**
         * Create a new NeoPixel driver for `numleds` LEDs.
         * @param pin the pin where the neopixel is connected.
         * @param numleds number of leds in the strip, eg: 24,30,60,64
         */
        //% blockId="neopixel_create" block="NeoPixel at pin %pin|with %numleds|leds as %mode"
        //% weight=90 blockGap=8
        //% parts="neopixel"
        //% trackArgs=0,2
        //% blockSetVariable=strip  group="三色环"
        export function RGBcreate(pin: DigitalPin, numleds: number, mode: NeoPixelMode): Strip {
            let strip = new Strip();
            let stride = mode === NeoPixelMode.RGBW ? 4 : 3;
            strip.buf = pins.createBuffer(numleds * stride);
            strip.start = 0;
            strip._length = numleds;
            strip._mode = mode;
            strip._matrixWidth = 0;
            strip.setBrightness(255)
            strip.setPin(pin)
            return strip;
        }
    
        /**
         * Converts red, green, blue channels into a RGB color
         * @param red value of the red channel between 0 and 255. eg: 255
         * @param green value of the green channel between 0 and 255. eg: 255
         * @param blue value of the blue channel between 0 and 255. eg: 255
         */
        //% weight=1
        //% blockId="neopixel_rgb" block="red %red|green %green|blue %blue"
        //% advanced=true  group="三色环"
        export function rgb(red: number, green: number, blue: number): number {
            return packRGB(red, green, blue);
        }
    
        /**
         * Gets the RGB value of a known color
        */
        //% weight=2 blockGap=8
        //% blockId="neopixel_colors" block="%color"
        //% advanced=true  group="三色环"
        export function colors(color: NeoPixelColors): number {
            return color;
        }
    
        function packRGB(a: number, b: number, c: number): number {
            return ((a & 0xFF) << 16) | ((b & 0xFF) << 8) | (c & 0xFF);
        }
        function unpackR(rgb: number): number {
            let r = (rgb >> 16) & 0xFF;
            return r;
        }
        function unpackG(rgb: number): number {
            let g = (rgb >> 8) & 0xFF;
            return g;
        }
        function unpackB(rgb: number): number {
            let b = (rgb) & 0xFF;
            return b;
        }
    
        /**
         * Converts a hue saturation luminosity value into a RGB color
         * @param h hue from 0 to 360
         * @param s saturation from 0 to 99
         * @param l luminosity from 0 to 99
         */
        //% blockId=neopixelHSL block="hue %h|saturation %s|luminosity %l"  group="三色环"
        export function hsl(h: number, s: number, l: number): number {
            h = Math.round(h);
            s = Math.round(s);
            l = Math.round(l);
    
            h = h % 360;
            s = Math.clamp(0, 99, s);
            l = Math.clamp(0, 99, l);
            let c = Math.idiv((((100 - Math.abs(2 * l - 100)) * s) << 8), 10000); //chroma, [0,255]
            let h1 = Math.idiv(h, 60);//[0,6]
            let h2 = Math.idiv((h - h1 * 60) * 256, 60);//[0,255]
            let temp = Math.abs((((h1 % 2) << 8) + h2) - 256);
            let x = (c * (256 - (temp))) >> 8;//[0,255], second largest component of this color
            let r$: number;
            let g$: number;
            let b$: number;
            if (h1 == 0) {
                r$ = c; g$ = x; b$ = 0;
            } else if (h1 == 1) {
                r$ = x; g$ = c; b$ = 0;
            } else if (h1 == 2) {
                r$ = 0; g$ = c; b$ = x;
            } else if (h1 == 3) {
                r$ = 0; g$ = x; b$ = c;
            } else if (h1 == 4) {
                r$ = x; g$ = 0; b$ = c;
            } else if (h1 == 5) {
                r$ = c; g$ = 0; b$ = x;
            }
            let m = Math.idiv((Math.idiv((l * 2 << 8), 100) - c), 2);
            let r = r$ + m;
            let g = g$ + m;
            let b = b$ + m;
            return packRGB(r, g, b);
        }
    
        export enum HueInterpolationDirection {
            Clockwise,
            CounterClockwise,
            Shortest
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

    function cmd(d: number) {
        RS = 0
        set(d)
        set(d << 4)
    }

    function dat(d: number) {
        RS = 1
        set(d)
        set(d << 4)
    }

    //% block="LcdInit $addr" addr.defl="39"  group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdInit(addr: number) {
        i2cAddr = addr
        BK = 8
        RS = 0
        cmd(0x33)
        basic.pause(5)
        set(0x30)
        basic.pause(5)
        set(0x20)
        basic.pause(5)
        cmd(0x28)
        cmd(0x0C)
        cmd(0x06)
        cmd(0x01)
    }

    //% block="showchar $ch|col $x|row $y"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdShowChar(ch: string, x: number, y: number): void {
        let a: number

        if (y > 0)
            a = 0xC0
        else
            a = 0x80
        a += x
        cmd(a)
        dat(ch.charCodeAt(0))
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
        cmd(a)

        for (let i = 0; i < s.length; i++) {
            dat(s.charCodeAt(i))
        }
    }

    //% block="lcdon"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdOn(): void {
        cmd(0x0C)
    }

    //% block="lcdoff"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdOff(): void {
        cmd(0x08)
    }

    //% block="lcdclear"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdClear(): void {
        cmd(0x01)
    }

    //% block="lcdlighton"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdBacklightOn(): void {
        BK = 8
        dat(0)
    }

    //% block="lcdlightoff"   group="1602液晶显示屏"  blockExternalInputs=true
    export function i2cLcdBacklightOff(): void {
        BK = 0
        dat(0)
    }
}

