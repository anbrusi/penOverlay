
export function attachPenOverlay(params) {
    let penOverlay = new PenOverlay(params);
}

class PenOverlay {
    /**
     * This is the div holding the wrapped document
     */
    parent = undefined;
    /**
     * The background color of penov-main div
     */
    backgroundColor = '#DDDDDD';
    /**
     * Width of the 'main' div 'penov-main'
     */
    mainWidth = '21cm'; // A4
    /**
     * Can be overriden if 'penWidth' is set in 'params' of the constructor
     */
    penWidth = 1;
    /**
     * Can be overriden if 'penColor' is set in 'params' of the constructor
     */
    penColor = '#FF4444';
    /**
     * Can be overriden if 'stepType' is set in 'params' of the constructor
     * Allowed stepTypes are 'L' for linear and 'B' fpor Bezier
     */
    stepType = 'B';
    /**
     * The penov-main div
     */
    main = undefined;
    /**
     * The div holding the raw document, which will be corrected
     */
    raw = undefined;
    /**
     * margin-left of 'penov-raw'
     */
    rawLeft = '0px';
    /**
     * margin-right of 'penov-raw'
     */
    rawRight = '40%';
    /**
     * Distance between lines in 'penov-raw'
     */
    lineHeight = 'normal';
    /**
     * The canvas absolutely positioned on top of 'penov-main'
     */
    canvas = undefined;
    /**
     * 2d context of canvas
     */
    ctx = undefined;
    constructor(params) {
        // Decode parameters
        let parameters = JSON.parse(params);
        this.parent = document.getElementById(parameters['parentid']);
        if (parameters['backgroundColor']) {
            this.backgroundColor = parameter['backgroundColor'];
        }
        if (parameters['mainWidth']) {
            this.mainWidth = parameter['mainWidth'];
        }
        if (parameters['penWidh']) {
            this.penWidth = parameter['penWidth'];
        }
        if (parameters['penColor']) {
            this.penColor = parameters['penColor'];
        }
        if (parameters['stepType']) {
            this.stepType = parameters['stepType'];
        }
        if (parameters['rawLeft']) {
            this.rawLeft = parameters['rawLeft'];
        }
        if (parameters['rawRight']) {
            this.rawRight = parameters['rawRight'];
        }
        if (parameters['lineHeight']) {
            this.lineHeight = parameters['lineHeight'];
        }
        // Set penov-main properties
        this.main = document.getElementById('penov-main');
        this.main.style['background-color'] = this.backgroundColor;
        this.main.style['touch-action'] = 'none'; 
        this.main.style.width = this.mainWidth;
        this.main.style.overflow = 'hidden';
        this.main.style.position = 'relative'; // Set relative position in order to place its child canvas absolutely
        // Set raw properties
        this.raw = document.getElementById('penov-raw');
        this.raw.style['margin-left'] = this.rawLeft;
        this.raw.style['margin-right'] = this.rawRight;
        this.raw.style['line-height'] = this.lineHeight;
        // Prepare canvas. The position is absolute and set to cover 'penov-main'
        this.canvas = document.getElementById('penov-canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = 0;
        window.addEventListener('load', this.boundLoadH);     
        
    }

    // Event handlers
    loadH(event) {
        this.canvas.style.width = this.main.clientWidth;
        this.canvas.style.height = this.main.clientHeight;
        this.ctx = this.canvas.getContext('2d');
    }
    boundLoadH = this.loadH.bind(this);
}