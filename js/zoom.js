// Get the modal
var modal = document.getElementById('zoomModal');

// Get the image and insert it inside the modal - use its "alt" text as a caption
var img = document.getElementById('avatar');
var modalImg = document.getElementById("avatar-zoom");
img.onclick = function(){
    modal.style.display = "flex";
    modalImg.src = this.src;
}


// When the user clicks on <span> (x), close the modal
modal.onclick = function() {
    setTimeout(function() {
       modal.style.display = "none";
     }, 300);
 }