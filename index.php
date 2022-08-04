<?php
class penOverlay {
    private function head():string {
        $html = '';
        $html .= '<head>';
        $html .= '<meta charset="UTF-8">';
        $html .= '<link rel="stylesheet" href="index.css">';
        $html .= '<title>penOverlay</title>';
        $html .= '</head>';
        return $html;
    }
    private function loadView():string {
        $html = '';
        $html .= '<h1>Load a document</h1>';
        $html .= '<form action="http://myProjects/penOverlay/index.php" method="POST">';
        $files = scandir('testFiles');
        if ($files === false) {
            $html .= 'No loadable files found';
        } else {
            $html .= '<select name="files">';
            foreach ($files as $file) {
                if ($file != '.' && $file != '..') {
                    $html .= '<option value="'.$file.'">'.$file.'</option>';
                }
            }
            $html .= '</select>';
        }
        $html .= '<p>';
        $html .= '<input type="submit" name="load" value="Load">';
        $html .= '</p>';
        $html .= '</form>';
        return $html;
    }
    /**
     * Wraps the HTML document, which should be annotated by pen in a standard way
     * 
     * @param string $html the raw document, which will be annotated or prepared for annotation 
     * @return string 
     */
    private function wrap(string $html):string {
        $wrapped = '';
        $wrapped .= '<!--penOverlay-->';
        $wrapped .= '<div id="penov-main">';
        $wrapped .= '<div id="penov-raw">';
        $wrapped .= $html;
        $wrapped .= '</div>'; // penow-raw
        $wrapped .= '<canvas id="penov-canvas" data-penovst="" data-penov=""></canvas>';
        $wrapped .= '<div id="penov-loading" class="loadingIndicator"></div>';
        $wrapped .= '</div>'; // penov-main
        $wrapped .= '<!--/penOverlay-->';
        return $wrapped;
    }
    private function buttons():string {
        $html = '';
        $html .= '<p>';
        $html .= '<input type="submit" name="escape" value="Escape">';
        $html .= '&nbsp;&nbsp;';
        $html .= '<input type="submit" name="penov-store" value="Store">';
        $html .= '</p>';
        return $html;
    }
    private function correctionView():string {
        $html = '';
        $html .= '<h2>This is just part of the wrap and is not active</h2>';
        $html .= '<form action="http://myProjects/penOverlay/index.php" method="POST">';
        $html .= $this->buttons();

        // div (penov-parent) holding the document to be corrected. The document itself is $rawContent
        // It must be wrapped for processing by JS. If it is not wrapped, it is wrapped here
        $html .= '<div id="penov-parent">';
        if (isset($_POST['files'])) {
            $rawContent = file_get_contents('testFiles/'.$_POST['files']);
            if (strpos(trim($rawContent), '<!--penOverlay-->') === 0) {
                $html .= $rawContent;
                $params = array('parentid' => 'penov-parent');
            } else {
                $html .= $this->wrap($rawContent);
                $params = array('parentid' => 'penov-parent', 'rawStyles' => 'margin-left: 10px; margin-right: 50%; line-height: 2em; font-size: 200%');
            }
        }
        $html .= '</div>'; // penov-parent

        // Load PenOverlay. NOTE: did not work, if inserted after the form
        $jsonParams = json_encode($params);
        $html .= '<script type="module">';
        $html .=    'import {attachPenOverlay} from "./isJS/modularJS/penOverlay.js";';
        $html .=    'attachPenOverlay(\''.$jsonParams.'\');';
        $html .= '</script>';        
        
        // Save the loaded filename for future use
        $html .= '<input type="hidden" name="file" value="'.$_POST['files'].'">';
        $html .= $this->buttons();
        $html .= '</form>';
        return $html;
    }
    private function body():string {
        $html = '';
        if (isset($_POST['load'])) { 
            $html .= '<body>';
            $html .= $this->correctionView();
        } elseif (isset($_POST['penov-store'])) {
            $html .= '<body>';
            if (isset($_POST['penov-document'])) {
                // Store the document
                $path = 'testFiles/'.$_POST['file'];
                $document = $_POST['penov-document'];
                file_put_contents($path, $document);
                $html .= $this->loadView();
            } else {
                $html .= '<div>There is no penov-document</div>';
                $html.= $this->loadView();
            }
        } else {
            $html .= '<body>';
            $html .= $this->loadView();
        }
        $html .= '</body>';
        return $html;
    }
    public function dispatch() {
        $html = '';
        $html .= '<html>';
        $html .= $this->head();
        $html .= $this->body();
        $html .= '</html>';
        echo $html;
    }
}
$penOverlay = new penOverlay();
$penOverlay->dispatch();