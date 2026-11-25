/*
Site behaviour for the Nivya Hospitals pages (trimmed from the original Doccure template:
only the parts the pages actually use are kept).
*/

(function ($) {
	"use strict";

	// Mobile menu: open sub-menus on tap
	if ($(window).width() <= 991) {
		$('.main-nav a').on('click', function (e) {
			if ($(this).parent().hasClass('has-submenu')) {
				e.preventDefault();
			}
			if (!$(this).hasClass('submenu')) {
				$('ul', $(this).parents('ul:first')).slideUp(350);
				$('a', $(this).parents('ul:first')).removeClass('submenu');
				$(this).next('ul').slideDown(350);
				$(this).addClass('submenu');
			} else if ($(this).hasClass('submenu')) {
				$(this).removeClass('submenu');
				$(this).next('ul').slideUp(350);
			}
		});
	}

	// Mobile menu sidebar overlay
	$('body').append('<div class="sidebar-overlay"></div>');
	$(document).on('click', '#mobile_btn', function () {
		$('.main-wrapper').toggleClass('slide-nav');
		$('.sidebar-overlay').toggleClass('opened');
		$('html').toggleClass('menu-opened');
		return false;
	});

	$(document).on('click', '.sidebar-overlay', function () {
		$('html').removeClass('menu-opened');
		$(this).removeClass('opened');
		$('.main-wrapper').removeClass('slide-nav');
	});

	$(document).on('click', '#menu_close', function () {
		$('html').removeClass('menu-opened');
		$('.sidebar-overlay').removeClass('opened');
		$('.main-wrapper').removeClass('slide-nav');
	});

	// Content div min height set
	function resizeInnerDiv() {
		var height = $(window).height();
		var header_height = $(".header").height();
		var footer_height = $(".footer").height();
		$(".content").css("min-height", height - header_height - footer_height);
	}

	if ($('.content').length > 0) {
		resizeInnerDiv();
		$(window).resize(resizeInnerDiv);
	}

	// Header Fixed
	if ($('header').length > 0) {
		$(window).scroll(function () {
			if ($(window).scrollTop() > 35) {
				$("header").addClass('fixed');
			} else {
				$("header").removeClass('fixed');
			}
		});
	}

	// Cursor
	function ensureCursorMarkup() {
		if (!$('.mouse-cursor').length) {
			$('body').append('<div class="mouse-cursor cursor-outer"></div><div class="mouse-cursor cursor-inner"></div>');
		}
	}

	function mim_tm_cursor() {
		var myCursor = jQuery('.mouse-cursor');
		if (myCursor.length) {
			const e = document.querySelector(".cursor-inner"),
				t = document.querySelector(".cursor-outer");
			let o = !1;
			window.onmousemove = function (s) {
				o || (t.style.transform = "translate(" + s.clientX + "px, " + s.clientY + "px)"), e.style.transform = "translate(" + s.clientX + "px, " + s.clientY + "px)"
			}, $("body").on("mouseenter", "a, .cursor-pointer", function () {
				e.classList.add("cursor-hover"), t.classList.add("cursor-hover")
			}), $("body").on("mouseleave", "a, .cursor-pointer", function () {
				$(this).is("a") && $(this).closest(".cursor-pointer").length || (e.classList.remove("cursor-hover"), t.classList.remove("cursor-hover"))
			}), e.style.visibility = "visible", t.style.visibility = "visible"
		}
	}

	ensureCursorMarkup();
	mim_tm_cursor();

	// Doctor list: favourite heart
	$('.fav-icon').on('click', function () {
		$(this).toggleClass('selected');
	});

	document.querySelectorAll(".fav-icon").forEach(btn => {
		btn.addEventListener("click", function () {
			const icon = this.querySelector("i");
			icon.classList.toggle("fa-regular");
			icon.classList.toggle("fa-solid");
			icon.style.color = icon.classList.contains("fa-solid") ? "red" : "";
		});
	});

	// Doctor list: filter toggle
	$(document).on('click', '#filter_search', function () {
		$('#filter_inputs').slideToggle("slow");
	});

	// Booking page calendar
	if ($('#datetimepickershow').length > 0) {
		$('#datetimepickershow').datetimepicker({
			inline: true,
			sideBySide: true,
			format: 'DD-MM-YYYY',
			icons: {
				up: "fas fa-angle-up",
				down: "fas fa-angle-down",
				next: 'fas fa-angle-right',
				previous: 'fas fa-angle-left'
			}
		});
	}

})(jQuery);

document.addEventListener("DOMContentLoaded", function () {
	// Home page: endless horizontal strip
	document.querySelectorAll(".horizontal-slide").forEach((scroller) => {
		scroller.setAttribute("data-animated", true);
		const scrollerInner = scroller.querySelector(".slide-list");
		Array.from(scrollerInner.children).forEach((item) => {
			const duplicatedItem = item.cloneNode(true);
			duplicatedItem.setAttribute("aria-hidden", true);
			scrollerInner.appendChild(duplicatedItem);
		});
	});

	// Home page testimonials: drag to scroll, auto-scroll when idle
	function initializeTestimonialDragScroll() {
		document.querySelectorAll('[data-drag-scroll]').forEach(function (track) {
			// Set up once; a later call (after images load) only retries the auto-scroll.
			if (track._startAutoScroll) {
				setTimeout(track._startAutoScroll, 500);
				return;
			}

			let isDragging = false;
			let isMouseOver = false;
			let startX = 0;
			let startScrollLeft = 0;
			let pointerId = null;
			let hasMoved = false;
			let autoScrollInterval = null;

			const checkScrollable = () => track.scrollWidth > track.clientWidth;

			const stopAutoScroll = () => {
				track.classList.remove('is-autoscrolling');
				if (autoScrollInterval) {
					clearInterval(autoScrollInterval);
					autoScrollInterval = null;
				}
			};

			const startAutoScroll = () => {
				if (isDragging || isMouseOver) return;
				stopAutoScroll();
				if (!checkScrollable()) return;
				track.classList.add('is-autoscrolling');
				autoScrollInterval = setInterval(() => {
					if (isDragging || isMouseOver) return;
					const maxScroll = track.scrollWidth - track.clientWidth;
					let currentScroll = track.scrollLeft + 2;
					if (currentScroll >= maxScroll) currentScroll = 0;
					track.scrollLeft = currentScroll;
				}, 25);
			};
			track._startAutoScroll = startAutoScroll;

			const stopDragging = () => {
				if (!isDragging) return;
				isDragging = false;
				track.classList.remove('is-dragging');
				document.body.classList.remove('testimonial-dragging');
				pointerId = null;
				setTimeout(() => {
					if (!isDragging && !isMouseOver) startAutoScroll();
				}, 1500);
			};

			const startDrag = (clientX, currentPointerId) => {
				stopAutoScroll();
				isDragging = true;
				hasMoved = false;
				startX = clientX;
				startScrollLeft = track.scrollLeft;
				pointerId = currentPointerId;
				track.classList.add('is-dragging');
				document.body.classList.add('testimonial-dragging');
			};

			const moveDrag = (clientX) => {
				if (!isDragging) return;
				hasMoved = true;
				track.scrollLeft = startScrollLeft - (clientX - startX) * 2;
			};

			track.addEventListener('mousedown', (event) => {
				if (event.button !== 0 || !checkScrollable()) return;
				startDrag(event.clientX, 'mouse');
			});
			track.addEventListener('mousemove', (event) => {
				if (!isDragging || pointerId !== 'mouse') return;
				moveDrag(event.clientX);
			});
			track.addEventListener('mouseup', stopDragging);
			track.addEventListener('mouseleave', () => {
				isMouseOver = false;
				stopDragging();
				setTimeout(() => {
					if (!isDragging) startAutoScroll();
				}, 300);
			});
			track.addEventListener('mouseenter', () => {
				isMouseOver = true;
				stopAutoScroll();
			});

			track.addEventListener('pointerdown', (event) => {
				if (event.button !== 0 || !checkScrollable()) return;
				startDrag(event.clientX, event.pointerId);
				if (track.setPointerCapture) track.setPointerCapture(event.pointerId);
			});
			track.addEventListener('pointermove', (event) => {
				if (!isDragging || event.pointerId !== pointerId) return;
				moveDrag(event.clientX);
			});
			track.addEventListener('pointerup', stopDragging);
			track.addEventListener('pointercancel', stopDragging);
			track.addEventListener('lostpointercapture', stopDragging);

			// Don't follow links or drag images while dragging
			track.querySelectorAll('img, a').forEach((node) => {
				node.addEventListener('dragstart', (event) => event.preventDefault());
				node.addEventListener('click', (event) => {
					if (hasMoved) {
						event.preventDefault();
						event.stopPropagation();
					}
				});
			});

			setTimeout(startAutoScroll, 500);
		});
	}

	jQuery(function () {
		setTimeout(initializeTestimonialDragScroll, 100);
	});
	window.addEventListener('load', initializeTestimonialDragScroll);

	// Home page scroll animations
	if (typeof WOW !== "undefined") {
		new WOW({
			offset: 0,
			mobile: true
		}).init();
	}
});
