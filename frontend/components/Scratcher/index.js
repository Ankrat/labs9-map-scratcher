
/*== Scratcher =================================================================

/*-- Documentation -------------------------------

Scratcher is a React Component which displays an Image, which a user may
scratch off to initiate an event. It accepts the following props:

    scratchable(boolean) - What kind of map to display. Options are:
        True - Display a scratchable map with flag overlay
        False - Display a simple colored map.
    urlMap(string/URL) - An image specifying the shape of the component.
    urlFlag(string/URL) - An image to be overlaid on the map shape.
    colorOutline(string/color) - The map shape is outlined in this color.
    colorScratch(string/color) - Scratching the image reveals this color.
    handleScratchAll(function) - A callback to invoke once fully scratched.
    handleLoadingError(function) - A callback invoked if images can't load.

The state of the component can be changed during use by sending it new props.
For example: a map can easily change from not scratchable to scratchable by
changing one value; or the country can be changed by passing a different set
of urls.

*/

//-- Dependencies --------------------------------
import React from 'react';
import * as utilities from './utilities.js';
import './scratcher.less';

//== React Life Cycle Methods ==================================================

//-- Constructor and definition ------------------
export default class Scratcher extends React.Component {
    constructor(props) {
        super(props);
        this.canvasRef = React.createRef();
    }
    
    //-- Render --------------------------------------
    render(props) {
        return <div className="scratcher" style={{width: '100%', height: '100%'}}>
            <canvas ref={this.canvasRef} style={{width: '100%', height: '100%'}}/>
        </div>
    }
    
    //-- Component has been rendered to the DOM ------
    async componentDidMount() {
        // Get display canvas from DOM (now that component has rendered)
        const displayCanvas = this.canvasRef.current;
        // Setup drawing contexts and load images
        try {
            await this.setup(displayCanvas);
        } catch(error) {
            this.props.handleLoadingError(error);
            return;
        }
        // Do initial Drawing
        this.draw(this.drawingState);
    }

    //-- Component Receives new Props ----------------
    async componentDidUpdate(previousProps) {
        // Determine what needs to be updated
        const changeColor = (
            this.props.colorOutline !== previousProps.colorOutline
        );
        const needsUpdate = (
            (this.props.scratchable  !== previousProps.scratchable ) ||
            (this.props.urlMap       !== previousProps.urlMap      ) ||
            (this.props.urlFlag      !== previousProps.urlFlag     ) ||
            (this.props.colorOutline !== previousProps.colorOutline)
        );
        // Reconfigure country, if necessary (shape, flag, outline)
        if(needsUpdate) {
            this.drawingState.colorOutline = this.props.colorOutline;
            this.drawingState.itchy = this.props.scratchable;
            try {
                const urlMap  = this.props.urlMap ;
                const urlFlag = this.props.urlFlag;
                await this.configureCountry(urlMap, urlFlag);
            } catch(error) {
                this.props.handleLoadingError(error);
                return;
            }
        }
        // Redraw if necessary
        if(changeColor || needsUpdate) {
            this.drawingState.colorScratch = this.props.colorScratch;
            this.draw(this.drawingState);
        }
    }
    

//== Non-React Methods =========================================================

    //-- Setup All Canvases and Values ---------------
    async setup(displayCanvas){
        // Create drawing state
        this.drawingState = {
            displayCanvas: displayCanvas,
            colorScratch: this.props.colorScratch,
            colorOutline: this.props.colorOutline,
        };
        // Setup Drawing Contexts
        this.generateDrawingContexts();
        // Configure for current Country
        const urlMap  = this.props.urlMap ;
        const urlFlag = this.props.urlFlag;
        await this.configureCountry(urlMap, urlFlag);
    }
    
    //-- Generate Drawing Contexts -------------------
    generateDrawingContexts() {
        const movementHandler = (moveEndX, moveEndY) => {
            this.handleMovement(moveEndX, moveEndY);
        };
        utilities.initializeCanvas(this.drawingState, movementHandler);
        utilities.createCompositingCanvas(this.drawingState);
    }
    
    //-- Configure Country ---------------------------
    async configureCountry(urlMap, urlFlag) {
        // Clear old data
        this.drawingState.imageMap     = undefined;
        this.drawingState.imageFlag    = undefined;
        this.drawingState.imageOutline = undefined;
        // Load Image from Urls
        await utilities.configureCountry(
            this.drawingState,
            urlMap, urlFlag,
        );
        // Setup scratch overlay
        this.drawingState.itchy = this.props.scratchable;
        utilities.createScratchLayer(this.drawingState);
        // Calculate number of pixels that need to be scratched
        this.drawingState.itchyPixels = utilities.unscratchedPixelCount(
            this.drawingState,
        );
        // Generate Outline
        const colorOutline = this.props.colorOutline;
        this.imageOutline = utilities.generateOutline(
            this.drawingState, colorOutline,
        );
    }

    //-- Draw Canvas ---------------------------------
    draw() {
        /* Cancel out if resources aren't ready. This can happen if
            props.scratchable is true, but no urlMap or urlImage are falsy or
            cannot be loaded.
        */
        if(!(this.drawingState.imageMap && this.drawingState.imageFlag)) {
            return;
        }
        // Redraw canvas on animation frame
        requestAnimationFrame(() => {
            utilities.draw(this.drawingState);
        })
    }
    
    //-- Handle Mouse & Touch Movements --------------
    handleMovement(moveEndX, moveEndY) {
        // Do nothing if the Scratcher isn't current scratchable
        if(!this.drawingState.itchy){ return;}
        // Compare to previous events (or initialize if first)
        const moveStartX = this.drawingState.lastMoveX || moveEndX;
        const moveStartY = this.drawingState.lastMoveY || moveEndY;
        // Store last movement on state, for future comparisons
        this.drawingState.lastMoveX = moveEndX;
        this.drawingState.lastMoveY = moveEndY;
        // Scratch line from previous coordinates to current coordinates
        utilities.eraseScratchLine(
            this.drawingState,
            moveStartX, moveStartY, moveEndX, moveEndY,
        );
        // Check if canvas is completely scratched
        if(this.drawingState.itchy) {
            const complete = utilities.checkCompletion(this.drawingState);
            if(complete) {
                this.drawingState.itchy = false;
                utilities.scratchAll(this.drawingState);
                this.props.handleScratchAll();
            }
        }
        // Redraw
        this.draw();
    }
}