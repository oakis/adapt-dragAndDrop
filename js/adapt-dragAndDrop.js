/*
 * adapt-dragAndDrop
 * Copyright (C) 2015 Bombardier Inc. (www.batraining.com)
 * https://github.com/BATraining/adapt-dragAndDrop/blob/master/LICENSE
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
define([
  'coreJS/adapt',
  'coreViews/questionView'
], function(Adapt, QuestionView) {

    var DragAndDrop = QuestionView.extend({

        initialize: function() {
            this.listenTo(Adapt, 'remove', this.remove);
            this.listenTo(this.model, 'change:_isVisible', this.toggleVisibility);
            this.model.set('_globals', Adapt.course.get('_globals'));
            this.preRender();
            if (Adapt.device.screenSize == 'large') {
                this.render();
            } else {
                this.reRender();
            }
        },

        events: function() {
            if (Modernizr.touch) {
                return {
                    'click .draggable-item': 'onClickDragItem',
                    'touchstart .draggable-item': 'onTouchStartItem'
                };
            } else {
                return {
                    'click .draggable-item': 'onClickDragItem',
                    'mousedown .draggable-item': 'onMouseDownDragItem'
                };
            }
        },

        resetQuestionOnRevisit: function() {
            this.resetQuestion();
        },

        setupQuestion: function() {
            this.listenTo(Adapt, 'device:changed', this.reRender, this);

            if(this.model.get("_shouldScale")) {
                this.listenTo(Adapt, 'device:resize', this.resizeItems, 200);
            }

            this.setupRandomisation();
        },

         setupRandomisation: function() {
            if (this.model.get('_isRandom') && this.model.get('_isEnabled')) {
                this.model.set('_draggableItems', _.shuffle(this.model.get('_draggableItems')));
            }

            if (!this.model.get('_isSubmitted')) {
                this.model.set('_droppableItems', _.shuffle(this.model.get('_droppableItems')));
            }
        },

        onQuestionRendered: function() {
            if (this.$('.dragAndDrop-widget').find('img').length !== 0) {
                this.$('.dragAndDrop-widget').imageready(_.bind(function() {
                    this.setReadyStatus();
                }, this));
            } else {
                this.setReadyStatus();
            }

            if(this.model.get("_shouldScale")) {
                this.resizeItems();
            }

            this.model.set('_initialDragAndDropWidgetView', this.$('.dragAndDrop-widget').html());
        },

        reRender: function() {
            if (Adapt.device.screenSize != 'large') {
                this.replaceWithObjectMatching();
            }
        },

        replaceWithObjectMatching: function() {
            if (!Adapt.componentStore.objectMatching) throw "Object Matching not included in build";
            var ObjectMatching = Adapt.componentStore.objectMatching;

            var model = this.prepareObjectMatchingModel();
            var newObjectMatching = new ObjectMatching({model: model});
            var $container = $(".component-container", $("." + this.model.get("_parentId")));

            newObjectMatching.reRender();
            if (model.get('_initialObjectMatchingWidgetView')) {
                newObjectMatching.$el.find('.objectMatching-widget').html(model.get('_initialObjectMatchingWidgetView'));
            }
            if(model.get('_isSubmitted')) {
                newObjectMatching.showMarking();
            }

            newObjectMatching.setupObjectMatching();
            $container.append(newObjectMatching.$el);

            Adapt.trigger('device:resize');
            _.defer(_.bind(function () {
                this.remove();
            }, this));
        },

        prepareObjectMatchingModel: function() {
            var model = this.model;
            model.set('_component', 'objectMatching');
            model.set('_wasDragAndDrop', true);
            return model;
        },

        resizeItems: function() {
            if(this.model.get("_shouldScale")) {
                var totalItems = this.model.get('_draggableItems').length;
                var draggableItemWidth = this.$('.draggable-item-container').width();
                var draggableItemHeight = this.$('.draggable-item-container').height();
                var width = this.$('.dragAndDrop-inner').width() / totalItems;
                var scale = width / draggableItemWidth;

                if(scale > 1) {
                    scale = 1;
                }

                var $dragContainers = this.$('.draggables-container, .droppables-container');
                $dragContainers.css({
                    '-ms-transform': 'scale(' + scale + ')',
                    '-moz-transform': 'scale(' + scale + ')',
                    '-webkit-transform': 'scale(' + scale + ')',
                    '-webkit-transform-style': 'preserve-3d',
                    '-webkit-transform': 'scale3d(' + scale + ',' + scale + ',' + scale + ')',
                    'transform': 'scale(' + scale + ')'
                });
                $dragContainers.height(draggableItemHeight * scale);

                this.$('.dragAndDrop-widget').width(draggableItemWidth * totalItems);

                this.scale = scale;
            }
        },

        onClickDragItem: function(event) {
            event && event.preventDefault();
        },

        // Mouse Events
        onMouseDownDragItem: function(event) {
            if (!this.model.get('_isEnabled')) {
                event && event.preventDefault();
                return false;
            }

            if ($('html').hasClass('ie8')) {
                $(document).on('mouseup', _.bind(this.onMouseUpDragItem, this));
            } else {
                $(window).on('mouseup', _.bind(this.onMouseUpDragItem, this));
            }
            $('body').on('mousemove', _.bind(this.onMouseMoveDragItem, this));

            var $currentItem = this.$(event.currentTarget);
            var currentDragedItemId = $currentItem.attr('data-id');
            if (currentDragedItemId) {
                this.model.set('_currentDragedItemId', currentDragedItemId);
                this.model.set('_currentWidth', $currentItem.parent('div').width());

                this.$('.dragAndDrop-dummy')
                    .width(this.model.get('_currentWidth'))
                    .html(this.$('[data-id=' + currentDragedItemId + ']').html());
            }

            return false;
        },

        onMouseMoveDragItem: function(event) {
            if (!this.model.get('_isEnabled')) {
                return false;
            }

            var posx = 0,
                posy = 0;
            if (!event) event = window.event;

            if (event.clientX || event.clientY) {
                posx = event.clientX;
                posy = event.clientY;
            }

            posx -= (this.model.get('_currentWidth') / 2);
            posy -= (this.model.get('_defaultHeight') / 2);

            var $dragAndDropDummy = this.$('.dragAndDrop-dummy');
            if ($dragAndDropDummy.hasClass('display-none')) {
                $dragAndDropDummy.removeClass('display-none');
            }

            $dragAndDropDummy.css({
                top: posy,
                left: posx
            });
        },

        onMouseUpDragItem: function(event) {
            if (!this.model.get('_isEnabled')) {
                event && event.preventDefault();
                return false;
            }

            this.$('.dragAndDrop-dummy').html('').addClass('display-none');
            if ($('html').hasClass('ie8')) {
                $(document).off('mouseup');
            } else {
                $(window).off('mouseup');
            }
            $('body').off('mousemove');

            var currentDragedItemId = this.model.get('_currentDragedItemId');
            var droppableItemId = this.getDropedItemIdForCoordinate(event.pageY, event.pageX);

            if (currentDragedItemId && droppableItemId) {
                this.putDraggableItem(this.model.get('_currentDragedItemId'), droppableItemId);
            }

            this.model.set('_currentDragedItemId', '');
        },

        // Touch Events
        onTouchStartItem: function(event) {
            if (!this.model.get('_isEnabled')) {
                event && event.preventDefault();
                return false;
            }

            this.$('.dragAndDrop-widget')
                .on('touchmove', _.bind(this.onTouchMoveItem, this))
                .on('touchend', _.bind(this.onTouchEndItem, this))
                .on('touchcancel', _.bind(this.onTouchCancelItem, this));

            var $currentItem = this.$(event.currentTarget);
            var currentDragedItemId = $currentItem.attr('data-id');
            if (currentDragedItemId) {
                this.model.set('_currentDragedItemId', currentDragedItemId);
                this.model.set('_currentWidth', $currentItem.parent('div').width());

                this.$('.dragAndDrop-dummy')
                    .width(this.model.get('_currentWidth'))
                    .html(this.$('[data-id=' + currentDragedItemId + ']').html());
            }

            return false;
        },

        onTouchMoveItem: function(event) {
            if (!this.model.get('_isEnabled') || !this.model.get('_currentDragedItemId')) {
                return false;
            }

            var posx = event.originalEvent.touches[0].clientX;
            var posy = event.originalEvent.touches[0].clientY;

            this.model.set({
                '_lastTop': event.originalEvent.touches[0].pageY,
                '_lastLeft': event.originalEvent.touches[0].pageX
            })

            posx = posx - (this.model.get('_currentWidth') / 2);
            posy = posy - (this.model.get('_defaultHeight') / 2);

            var $dragAndDropDummy = this.$('.dragAndDrop-dummy');
            if ($dragAndDropDummy.hasClass('display-none')) {
                $dragAndDropDummy.removeClass('display-none');
            }

            $dragAndDropDummy.css({
                top: posy,
                left: posx
            });
        },

        onTouchEndItem: function(event) {
            var currentDragedItemId = this.model.get('_currentDragedItemId');
            var lastTop = this.model.get('_lastTop');
            var lastLeft = this.model.get('_lastLeft');
            if (!this.model.get('_isEnabled') || !currentDragedItemId || !lastTop || !lastLeft) {
                event && event.preventDefault();
                return false;
            }

            this.$('.dragAndDrop-dummy').html('').addClass('display-none');

            var droppableItemId = this.getDropedItemIdForCoordinate(lastTop, lastLeft);
            if (currentDragedItemId && droppableItemId) {
                this.putDraggableItem(this.model.get('_currentDragedItemId'), droppableItemId);
            }

            this.model.set('_currentDragedItemId', '');
            this.model.unset('_lastTop');
            this.model.unset('_lastLeft');

            this.$('.dragAndDrop-widget').off('touchmove touchend touchcancel');
        },

        onTouchCancelItem: function(event) {
            this.$('.dragAndDrop-dummy').html('').addClass('display-none');
            this.model.set('_currentDragedItemId', '');
            this.model.unset('_lastTop');
            this.model.unset('_lastLeft');
            this.$('.dragAndDrop-widget').off('touchmove touchend touchcancel');
        },

        getDropedItemIdForCoordinate: function(top, left) {
            var defaultWidth = this.model.get('_currentWidth');
            var defaultHeight = this.model.get('_defaultHeight');
            var droppedItemId;

            _.each(this.$('.droppable-item '), function(item, index) {
                var $item =$(item);
                var itemTop = $item.offset().top;
                var itemLeft = $item.offset().left;
                var itemBottom = itemTop + defaultHeight;
                var itemRight = itemLeft + defaultWidth;

                if ((top > itemTop && top < itemBottom) && (left > itemLeft && left < itemRight)) {
                    droppedItemId = $item.attr('data-id');
                }
            });

            return droppedItemId;
        },

        putDraggableItem: function(currentDragedItemId, droppableItemId) {
            if (!this.model.get('_isEnabled') || !currentDragedItemId || !droppableItemId) {
                return false;
            }

            var $currentDropContainer = this.$('[data-id=' + droppableItemId + ']');
            var $currentDragedItem = this.$('[data-id=' + currentDragedItemId + ']');
            var $currentDragedItemContainer = $currentDragedItem.closest('div');
            var $existingDragItem = $currentDropContainer.find('.draggable-item');
            var existingDragItemId = $existingDragItem.attr('data-id');

            if (currentDragedItemId == existingDragItemId) return;

            var currentDropIndex = $currentDropContainer.attr('index');
            var currentDragIndex = $currentDragedItemContainer.attr('index');
            var droppableItems = this.model.get('_droppableItems');

            if ($existingDragItem.length > 0) {
                if ($currentDragedItemContainer.hasClass('draggable-item-wrapper')) {
                    $currentDragedItemContainer.html($existingDragItem);
                    delete droppableItems[currentDropIndex]['_selectedItemId'];
                } else if ($currentDragedItemContainer.hasClass('droppable-item')) {
                    $currentDragedItemContainer.html($existingDragItem);
                    droppableItems[currentDragIndex]._selectedItemId = existingDragItemId;
                }
            } else if ($currentDragedItemContainer.hasClass('droppable-item')) {
                $currentDragedItemContainer.html(droppableItems[currentDragIndex].body);
                delete droppableItems[currentDragIndex]['_selectedItemId'];
            }

            $currentDropContainer.html($currentDragedItem);
            droppableItems[currentDropIndex]._selectedItemId = currentDragedItemId;
        },

        canSubmit: function() {
            var count = 0;

            _.each(this.model.get('_droppableItems'), function(item) {
                if (item._selectedItemId) {
                    count++;
                }
            });
            return (count == this.model.get('_droppableItems').length);
        },

        // Blank method for question to fill out when the question cannot be submitted
        onCannotSubmit: function() {},

        storeUserAnswer: function() {
            var userAnswer = [];
            _.each(this.model.get('_droppableItems'), function(item, index) {
                userAnswer.push(item._selectedItemId);
            }, this);
            this.model.set('_userAnswer', userAnswer);
        },

        isCorrect: function() {
            var numberOfRequiredAnswers = this.model.get('_droppableItems').length;
            var numberOfCorrectAnswers = 0;
            var numberOfIncorrectAnswers = 0;

            _.each(this.model.get('_droppableItems'), function(item, index) {

                // Set item._isSelected to either true or false
                var isCorrect = item.correctItemId === item._selectedItemId;

                if (isCorrect) {
                    // If the item is selected adjust correct answer
                    numberOfCorrectAnswers++;
                    // Set item to correct - is used for returning to this component
                    item._isCorrect = true;
                    // Set that at least one correct answer has been selected
                    // Used in isPartlyCorrect method below
                    this.model.set('_isAtLeastOneCorrectSelection', true);
                }

            }, this);

            this.model.set('_numberOfCorrectAnswers', numberOfCorrectAnswers);

            // Check if correct answers matches correct items and there are no incorrect selections
            var answeredCorrectly = (numberOfCorrectAnswers === numberOfRequiredAnswers) && (numberOfIncorrectAnswers === 0);
            return answeredCorrectly;
        },

        setScore: function() {
            var questionWeight = this.model.get("_questionWeight");
            var answeredCorrectly = this.model.get('_isCorrect');
            var score = answeredCorrectly ? questionWeight : 0;
            this.model.set('_score', score);
        },

        showMarking: function() {
            _.each(this.model.get('_droppableItems'), function(item, i) {

                var $item = this.$('.droppable-item').eq(i);
                $item.addClass(item._isCorrect ? 'correct' : 'incorrect');

            }, this);
        },

        isPartlyCorrect: function() {
            return this.model.get('_isAtLeastOneCorrectSelection');
        },

        resetUserAnswer: function() {
            this.model.set('_userAnswer', []);
        },

        resetQuestion: function() {
            _.each(this.model.get('_droppableItems'), function(item) {
                delete item._selectedItemId;
                item._isCorrect = false;
            });

            this.$('.dragAndDrop-widget').html(this.model.get('_initialDragAndDropWidgetView'));

            this.model.set({
                _currentWidth: 0,
                _currentDragedItemId: '',
                _isAtLeastOneCorrectSelection: false
            });
        },

        showCorrectAnswer: function() {
            _.each(this.model.get('_droppableItems'), function(item, index) {
                this.setdroppableItems(index, item.correctItemId);
            }, this);
        },

        setdroppableItems: function(droppableContainerIndex, draggableItemId) {
            var $droppableItemContainer = this.$('.droppable-item').eq(droppableContainerIndex);
            var $draggableItem = this.$('.draggable-item[data-id=' + draggableItemId + ']');

            var $existingDragItem = $droppableItemContainer.find('.draggable-item');
            if ($existingDragItem.length > 0) {
                $draggableItem.closest('div').html($existingDragItem);
            }

            $droppableItemContainer.html($draggableItem);
        },

        hideCorrectAnswer: function() {
            _.each(this.model.get('_droppableItems'), function(item, index) {
                this.setdroppableItems(index, this.model.get('_userAnswer')[index]);
            }, this);
        }

    });

    Adapt.register('dragAndDrop', DragAndDrop);

    return DragAndDrop;

});
