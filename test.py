import socket
import threading
import random

clients = []

def handle_client(client_socket):  
    clients.append(client_socket)
    client_socket.close()

def offer_file_to_client(client_socket):
    file_name = "example.txt"
    client_socket.send(file_name.encode("utf-8"))
    client_socket.settimeout(10)

    try:
        response = client_socket.recv(1024).decode("utf-8")
        if response.lower() == 'accept':
            client_socket.send("Sending file...".encode("utf-8"))
            with open(file_name, "rb") as file:
                file_content = file.read()
                client_socket.sendall(file_content)
        elif response.lower() == 'reject':
            client_socket.send("File rejected.".encode("utf-8"))
    except socket.timeout:
        print("No response from client.")
        client_socket.close()
        clients.remove(client_socket)
        pass

def start_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("0.0.0.0", 9999))
    server.listen(5)
    
    while True:
        client_socket = server.accept()
        client_thread = threading.Thread(target=handle_client, args=(client_socket,))
        client_thread.start()
        while True:
            if len(clients) > 0:
                chosen_client = random.choice(clients)
                offer_file_to_client(chosen_client)

if __name__ == "__main__":
    start_server()