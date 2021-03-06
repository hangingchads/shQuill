'use strict';
require('./sh-quill.scss');
let React = require('react'),
    ReactDOM = require('react-dom'),
    QuillToolbar = require('./toolbar'),
    QuillMixin = require('./mixin'),
    T = React.PropTypes;

// FIXME: Remove with the switch to JSX
QuillToolbar = React.createFactory(QuillToolbar);

let find = function(arr, predicate) {
    if (!arr) {
        return;
    }
    for (let i=0; i<arr.length; ++i) {
        if (predicate(arr[i])) return arr[i];
    }
};

let QuillComponent = React.createClass({
    displayName: 'Quill',

    mixins: [ QuillMixin ],

    propTypes: {
        id: T.string,
        className: T.string,
        style: T.object,
        value: T.string,
        defaultValue: T.string,
        placeholder: T.string,
        readOnly: T.bool,
        modules: T.object,
        toolbar: T.oneOfType([ T.array, T.oneOf([false]), ]), // deprecated for v1.0.0, use toolbar module
        formats: T.array,
        styles: T.oneOfType([ T.object, T.oneOf([false]) ]),
        theme: T.string,
        pollInterval: T.number,
        onKeyPress: T.func,
        onKeyDown: T.func,
        onKeyUp: T.func,
        onChange: T.func,
        onChangeSelection: T.func
    },

    /*
    Changing one of these props should cause a re-render.
    */
    dirtyProps: [
        'id',
        'className',
        'modules',
        'toolbar',
        'formats',
        'styles',
        'theme',
        'pollInterval'
    ],

    getDefaultProps: function() {
        return {
            className: '',
            theme: 'snow',
            modules: {}
        };
    },

    /*
    We consider the component to be controlled if
    whenever `value` is bein sent in props.
    */
    isControlled: function() {
        return 'value' in this.props;
    },

    getInitialState: function() {
        return {
            value: this.isControlled()
                ? this.props.value
                : this.props.defaultValue
        };
    },

    componentWillReceiveProps: function(nextProps) {
        let editor = this.state.editor;
        // If the component is unmounted and mounted too quickly
        // an error is thrown in setEditorContents since editor is
        // still undefined. Must check if editor is undefined
        // before performing this call.
        if (editor) {
            // Update only if we've been passed a new `value`.
            // This leaves components using `defaultValue` alone.
            if ('value' in nextProps) {
                // NOTE: Seeing that Quill is missing a way to prevent
                //       edits, we have to settle for a hybrid between
                //       controlled and uncontrolled mode. We can't prevent
                //       the change, but we'll still override content
                //       whenever `value` differs from current state.
                if (nextProps.value !== this.getEditorContents()) {
                    this.setEditorContents(editor, nextProps.value);
                }
            }
            // We can update readOnly state in-place.
            if ('readOnly' in nextProps) {
                if (nextProps.readOnly !== this.props.readOnly) {
                    this.setEditorReadOnly(editor, nextProps.readOnly);
                }
            }
        }
    },

    componentDidMount: function() {
        let editor = this.createEditor(
            this.getEditorElement(),
            this.getEditorConfig());

        // this.setCustomFormats(editor); // deprecated in Quill v1.0
        let fontOptions = document.querySelectorAll('.quill-toolbar .ql-font.ql-picker .ql-picker-item');
        for (let i=0; i<fontOptions.length; ++i) {
            fontOptions[i].style.fontFamily = fontOptions[i].dataset.value;
        }

        this.setState({ editor:editor });
    },

    componentWillUnmount: function() {
        // NOTE: Don't set the state to null here
        //       as it would generate a loop.
    },

    shouldComponentUpdate: function(nextProps, nextState) {
        // Check if one of the changes should trigger a re-render.
        for (let i=0; i<this.dirtyProps.length; i++) {
            let prop = this.dirtyProps[i];
            if (nextProps[prop] !== this.props[prop]) {
                return true;
            }
        }
        // Never re-render otherwise.
        return false;
    },

    /*
    If for whatever reason we are rendering again,
    we should tear down the editor and bring it up
    again.
    */
    componentWillUpdate: function() {
        this.componentWillUnmount();
    },

    componentDidUpdate: function() {
        this.componentDidMount();
    },

    /**
     * @deprecated v1.0.0
     */
    setCustomFormats: function (editor) {
        if (!this.props.formats) {
            return;
        }

        for (let i = 0; i < this.props.formats.length; i++) {
            let format = this.props.formats[i];
            editor.addFormat(format.name || format, format);
        }
    },

    getEditorConfig: function() {
        let config = {
            readOnly:     this.props.readOnly,
            theme:        this.props.theme,
            formats:      this.props.formats, // Let Quill set the defaults, if no formats supplied
            styles:       this.props.styles,
            modules:      this.props.modules,
            pollInterval: this.props.pollInterval,
            bounds:       this.props.bounds,
            placeholder:  this.props.placeholder,
        };
        // Unless we're redefining the toolbar, or it has been explicitly
        // disabled, attach to the default one as a ref.
        // Note: Toolbar should be configured as a module for Quill v1.0.0 and above
        // Pass toolbar={false} for versions >1.0
        if (this.props.toolbar !== false && !config.modules.toolbar) {
            // Don't mutate the original modules
            // because it's shared between components.
            config.modules = JSON.parse(JSON.stringify(config.modules));
            config.modules.toolbar = {
                container: ReactDOM.findDOMNode(this.refs.toolbar)
            }
        }
        return config;
    },

    getEditor: function() {
        return this.state.editor;
    },

    getEditorElement: function() {
        return ReactDOM.findDOMNode(this.refs.editor);
    },

    getEditorContents: function() {
        return this.state.value;
    },

    getEditorSelection: function() {
        return this.state.selection;
    },

    /*
    Renders either the specified contents, or a default
    configuration of toolbar and contents area.
    */
    renderContents: function() {
        let contents = [];
        let children = React.Children.map(
            this.props.children,
            function(c) { return React.cloneElement(c, {ref: c.ref}); }
        );

        if (this.props.toolbar !== false) {
            let toolbar = find(children, function(child) {
                return child.ref === 'toolbar';
            });
            contents.push(toolbar ? toolbar : QuillToolbar({
                key: 'toolbar-' + Math.random(),
                ref: 'toolbar',
                items: this.props.toolbar
            }))
        }

        let editor = find(children, function(child) {
            return child.ref === 'editor';
        });
        contents.push(editor ? editor : React.DOM.div({
            key: 'editor-' + Math.random(),
            ref: 'editor',
            className: 'sh-quill-contents',
            dangerouslySetInnerHTML: { __html:this.getEditorContents() }
        }));

        return contents;
    },

    render: function() {
        return React.DOM.div({
            id: this.props.id,
            style: this.props.style,
            className: ['sh-quill'].concat(this.props.className).join(' '),
            onKeyPress: this.props.onKeyPress,
            onKeyDown: this.props.onKeyDown,
            onKeyUp: this.props.onKeyUp,
            onChange: this.preventDefault },
            this.renderContents()
        );
    },

    onEditorChange: function(value, delta, source, editor) {
        if (value !== this.getEditorContents()) {
            this.setState({ value: value });
            if (this.props.onChange) {
                this.props.onChange(value, delta, source, editor);
            }
        }
    },

    onEditorChangeSelection: function(range, source, editor) {
        let s = this.getEditorSelection() || {};
        let r = range || {};
        if (r.length !== s.length || r.index !== s.index) {
            this.setState({ selection: range });
            if (this.props.onChangeSelection) {
                this.props.onChangeSelection(range, source, editor);
            }
        }
    },

    focus: function() {
        this.state.editor.focus();
    },

    blur: function() {
        this.setEditorSelection(this.state.editor, null);
    },

    /*
    Stop change events from the toolbar from
    bubbling up outside.
    */
    preventDefault: function(event) {
        event.preventDefault();
        event.stopPropagation();
    }
});

module.exports = QuillComponent;
